(function (window, $) {
    var playlist = window.SHOWCASE_PLAYLIST || [];
    if (!playlist.length) {
        window.MusicPlayer = {
            mount: function () { },
            detachToDock: function () { }
        };
        return;
    }

    var state = {
        currentIndex: 0,
        duration: 0,
        isPlaying: false,
        widgetReady: false
    };

    var selectors = {
        player: '#music-player',
        title: '#mp-title',
        artist: '#mp-artist',
        playToggle: '#mp-play-toggle',
        prev: '#mp-prev',
        next: '#mp-next',
        currentTime: '#mp-current',
        duration: '#mp-duration',
        progressBar: '#mp-progress-bar',
        progressWrap: '.mp-progress',
        playlist: '#mp-playlist'
    };

    var widget = null;
    var stashEl = null;
    var initialized = false;
    var firstTrack = true;

    function ensureStash() {
        if (!stashEl) {
            stashEl = document.getElementById('music-player-stash');
        }
        return stashEl;
    }

    function formatTime(ms) {
        if (!ms || isNaN(ms)) return '0:00';
        var totalSeconds = Math.floor(ms / 1000);
        var minutes = Math.floor(totalSeconds / 60);
        var seconds = totalSeconds % 60;
        return minutes + ':' + (seconds < 10 ? '0' + seconds : seconds);
    }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function buildWidgetSrc(url) {
        return 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(url) + '&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&visual=false';
    }

    function ensureIframe() {
        if (!window.SC || !window.SC.Widget) {
            console.warn('SoundCloud widget API not available');
            return;
        }
        var iframe = document.getElementById('sc-widget-bridge');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'sc-widget-bridge';
            iframe.className = 'd-none';
            iframe.allow = 'autoplay';
            iframe.src = buildWidgetSrc(playlist[state.currentIndex].url);
            document.body.appendChild(iframe);
        } else if (!iframe.src) {
            iframe.src = buildWidgetSrc(playlist[state.currentIndex].url);
        }
        widget = SC.Widget(iframe);
        bindWidgetEvents();
    }

    function bindWidgetEvents() {
        if (!widget) return;
        widget.bind(SC.Widget.Events.READY, function () {
            state.widgetReady = true;
            widget.getDuration(function (duration) {
                state.duration = duration || 0;
                updateTime(0, state.duration);
            });
        });

        widget.bind(SC.Widget.Events.PLAY, function () {
            state.isPlaying = true;
            setPlayIcon();
        });

        widget.bind(SC.Widget.Events.PAUSE, function () {
            state.isPlaying = false;
            setPlayIcon();
        });

        widget.bind(SC.Widget.Events.FINISH, function () {
            playNext(true);
        });

        widget.bind(SC.Widget.Events.PLAY_PROGRESS, function (event) {
            state.duration = event && event.duration ? event.duration : state.duration;
            updateTime(event.currentPosition, state.duration);
        });
    }

    function setPlayIcon() {
        var btn = document.querySelector(selectors.playToggle);
        if (!btn) return;
        var icon = btn.querySelector('i');
        if (!icon) return;
        icon.className = state.isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    }

    function updateInfo() {
        var titleEl = document.querySelector(selectors.title);
        var artistEl = document.querySelector(selectors.artist);
        var track = playlist[state.currentIndex];
        if (titleEl) titleEl.innerHTML = escapeHtml(track.title).replace(/\n/g, '<br>');
        if (artistEl) artistEl.innerHTML = escapeHtml(track.artist).replace(/\n/g, '<br>');
        highlightActive();
    }

    function updateTime(current, total) {
        var currentEl = document.querySelector(selectors.currentTime);
        var durationEl = document.querySelector(selectors.duration);
        var bar = document.querySelector(selectors.progressBar);
        if (currentEl) currentEl.textContent = formatTime(current);
        if (durationEl) durationEl.textContent = formatTime(total);
        if (bar && total) {
            var percent = Math.min(100, Math.max(0, (current / total) * 100));
            bar.style.transition = 'width 0.18s cubic-bezier(0.2, 0.8, 0.4, 1)';
            bar.style.width = percent + '%';
        }
    }

    function ensurePlaylistData() {
        if (playlist.length === 0 && Array.isArray(window.SHOWCASE_PLAYLIST)) {
            playlist = window.SHOWCASE_PLAYLIST;
        }
    }

    function renderPlaylist() {
        ensurePlaylistData();
        var listEl = document.querySelector(selectors.playlist);
        if (!listEl) return;
        listEl.innerHTML = '';
        playlist.forEach(function (track, idx) {
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
            item.dataset.index = idx;
            item.innerHTML = '<span class="track-title">' + escapeHtml(track.title).replace(/\n/g, '<br>') + '</span>' +
                '<span class="track-artist text-muted small">' + escapeHtml(track.artist).replace(/\n/g, '<br>') + '</span>';
            item.addEventListener('click', function () {
                loadTrack(idx, true);
            });
            listEl.appendChild(item);
        });
        highlightActive();
    }

    function highlightActive() {
        var listEl = document.querySelector(selectors.playlist);
        if (!listEl) return;
        var items = listEl.querySelectorAll('button');
        items.forEach(function (btn, idx) {
            if (idx === state.currentIndex) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    async function loadTrack(index) {
        if (firstTrack) {   // idk why Safari needs this
            widget.play();
            await new Promise(resolve => setTimeout(resolve, 100));
            widget.play();
            firstTrack = false;
        }
        state.currentIndex = index;
        state.isPlaying = true;
        var track = playlist[state.currentIndex];
        updateInfo();
        setPlayIcon();
        updateTime(0, state.duration || 1);
        if (widget) {
            widget.load(track.url, {
                auto_play: true,
                show_comments: false,
                buying: false,
                sharing: false,
                download: false,
                show_playcount: false,
                visual: false,
                single_active: true,
                callback: function () {
                    state.widgetReady = true;
                    widget.getDuration(function (duration) {
                        state.duration = duration || 0;
                        updateTime(0, state.duration);
                    });
                    state.isPlaying = true;
                    setPlayIcon();
                }
            });
        }
    }

    function playNext() {
        var nextIndex = (state.currentIndex + 1) % playlist.length;
        loadTrack(nextIndex);
    }

    function playPrev() {
        var prevIndex = (state.currentIndex - 1 + playlist.length) % playlist.length;
        loadTrack(prevIndex);
    }

    function togglePlay() {
        if (!widget) return;
        widget.isPaused(function (paused) {
            if (paused) {
                widget.play();
                if (firstTrack) {   // idk why Safari needs this
                    setTimeout(function () {
                        widget.play();
                    }, 100);
                    firstTrack = false;
                }
            } else {
                widget.pause();
            }
        });
    }

    function seekTo(event) {
        var wrap = event.currentTarget;
        if (!wrap || !state.duration) return;
        var rect = wrap.getBoundingClientRect();
        var percent = (event.clientX - rect.left) / rect.width;
        percent = Math.min(1, Math.max(0, percent));
        widget.seekTo(state.duration * percent);
    }

    function bindUI() {
        var player = document.querySelector(selectors.player);
        if (!player || player.dataset.bound === 'true') return;
        player.dataset.bound = 'true';

        var playBtn = document.querySelector(selectors.playToggle);
        var prevBtn = document.querySelector(selectors.prev);
        var nextBtn = document.querySelector(selectors.next);
        var progressWrap = document.querySelector(selectors.progressWrap);

        if (playBtn) playBtn.addEventListener('click', togglePlay);
            if (prevBtn) prevBtn.addEventListener('click', function () { playPrev(); });
            if (nextBtn) nextBtn.addEventListener('click', function () { playNext(); });
        if (progressWrap) progressWrap.addEventListener('click', seekTo);
    }

    function getPlayerEl() {
        return document.querySelector(selectors.player);
    }

    function stash() {
        var player = getPlayerEl();
        if (!player) return;
        ensureStash();
        player.classList.remove('mp-floating');
        stashEl.appendChild(player);
    }

    function initializeIfNeeded() {
        var player = getPlayerEl();
        if (!player || initialized) return;
        ensureIframe();
        if (!widget) return;
        renderPlaylist();
        bindUI();
        updateInfo();
        setPlayIcon();
        initialized = true;
    }

    function mount() {
        var player = getPlayerEl();
        if (!player) return;
        initializeIfNeeded();
        var slot = document.getElementById('music-player-slot');
        var onShowcase = window.location.pathname.indexOf('showcase') !== -1;
        if (slot && onShowcase) {
            slot.innerHTML = '';
            slot.appendChild(player);
            player.style.display = '';
            if (widget && state.widgetReady) {
                widget.isPaused(function(paused) {
                    state.isPlaying = !paused;
                    setPlayIcon();
                });
            }
        } else {
            stash();
            player.style.display = 'none';
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        mount();
    });

    window.MusicPlayer = {
        mount: mount,
        stash: stash
    };

})(window, jQuery);