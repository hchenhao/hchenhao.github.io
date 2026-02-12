(function (window) {
    function init($) {
        if (window.MusicPlayer && window.MusicPlayer._initialized) {
            window.MusicPlayer.mount();
            return;
        }

        var playlist = window.SHOWCASE_PLAYLIST || [];
        if (!playlist.length) {
            window.MusicPlayer = {
                mount: function () { },
                stash: function () { },
                _initialized: false
            };
            return;
        }

        var state = {
            currentIndex: 0,
            duration: 0,
            isPlaying: false,
            widgetReady: false,
            loopOne: false,
            playEventSent: false
        };

        function trackPlayEvent(track) {
            if (typeof gtag !== 'function' || !track) return;
            gtag('event', 'song_play', {
                song_title: track.title || '',
                artist: track.artist || '',
                song_url: track.url || '',
                index: state.currentIndex
            });
        }

        var selectors = {
            player: '#music-player',
            widget: '.music-player-widget',
            title: '#mp-title',
            artist: '#mp-artist',
            playToggle: '#mp-play-toggle',
            prev: '#mp-prev',
            next: '#mp-next',
            loopToggle: '#mp-loop-toggle',
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
                stashEl = document.getElementById('stash');
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
                    updateTime(0, state.duration, false);
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
                if (state.loopOne) {
                    widget.seekTo(0);
                    widget.play();
                } else {
                    playNext(true);
                }
            });

            widget.bind(SC.Widget.Events.PLAY_PROGRESS, function (event) {
                state.duration = event && event.duration ? event.duration : state.duration;
                updateTime(event.currentPosition, state.duration, false);
            });
        }

        function setPlayIcon() {
            var btn = document.querySelector(selectors.playToggle);
            if (!btn) return;
            var icon = btn.querySelector('i');
            if (!icon) return;
            icon.className = state.isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
        }

        function setLoopIcon() {
            var btn = document.querySelector(selectors.loopToggle);
            if (!btn) return;
            var icon = btn.querySelector('i');
            btn.classList.toggle('btn-outline-secondary', !state.loopOne);
            btn.classList.toggle('btn-secondary', state.loopOne);
            btn.classList.toggle('mp-loop-one', state.loopOne);
            btn.setAttribute('aria-pressed', state.loopOne ? 'true' : 'false');
            if (icon) {
                icon.className = 'fa-solid fa-repeat';
            }
        }

        function updateInfo() {
            var titleEl = document.querySelector(selectors.title);
            var artistEl = document.querySelector(selectors.artist);
            var track = playlist[state.currentIndex];
            if (titleEl) titleEl.innerHTML = escapeHtml(track.title).replace(/\n/g, '<br>');
            if (artistEl) artistEl.innerHTML = escapeHtml(track.artist).replace(/\n/g, '<br>');
            highlightActive();
        }

        function updateTime(current, total, reset) {
            var currentEl = document.querySelector(selectors.currentTime);
            var durationEl = document.querySelector(selectors.duration);
            var bar = document.querySelector(selectors.progressBar);
            if (!reset && current < 500) {
                state.playEventSent = false;
            }
            if (currentEl) currentEl.textContent = formatTime(current);
            if (durationEl) durationEl.textContent = formatTime(total);
            if (bar && total) {
                var percent = Math.min(100, Math.max(0, (current / total) * 100));
                bar.style.transition = 'width 0.18s cubic-bezier(0.2, 0.8, 0.4, 1)';
                bar.style.width = percent + '%';
            }
            if (!reset && !state.playEventSent && current >= 1000) {
                state.playEventSent = true;
                var track = playlist[state.currentIndex];
                trackPlayEvent(track);
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
            updateTime(0, state.duration || 1, true);
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
                            updateTime(0, state.duration, false);
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

        function toggleLoop() {
            state.loopOne = !state.loopOne;
            setLoopIcon();
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
            var loopBtn = document.querySelector(selectors.loopToggle);
            var progressWrap = document.querySelector(selectors.progressWrap);

            if (playBtn) playBtn.addEventListener('click', togglePlay);
            if (prevBtn) prevBtn.addEventListener('click', function () { playPrev(); });
            if (nextBtn) nextBtn.addEventListener('click', function () { playNext(); });
            if (loopBtn) loopBtn.addEventListener('click', function () { toggleLoop(); });
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
            setLoopIcon();
            initialized = true;
        }

        function mount() {
            var onShowcase = window.location.pathname.indexOf('showcase') !== -1;
            var slot = document.getElementById('music-player-slot');
            var playerId = selectors.player.slice(1);
            var activePlayer = document.querySelector(selectors.player);
            var freshWidgets = document.querySelectorAll(selectors.widget + ':not(' + selectors.player + ')');

            freshWidgets.forEach(function(w) {
                if (activePlayer) {
                    w.remove();
                } else {
                    w.id = playerId;
                    activePlayer = w;
                }
            });

            var player = activePlayer;
            if (!player) return;

            initializeIfNeeded();

            if (slot && onShowcase) {
                if (player.parentNode !== slot) {
                    slot.innerHTML = '';
                    slot.appendChild(player);
                }
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

        mount();

        window.MusicPlayer = {
            mount: mount,
            stash: stash,
            _initialized: true
        };
    }

    function waitForJQuery(callback) {
        if (window.jQuery) {
            callback(window.jQuery);
        } else {
            var checkInterval = setInterval(function () {
                if (window.jQuery) {
                    clearInterval(checkInterval);
                    callback(window.jQuery);
                }
            }, 50);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            waitForJQuery(init);
        });
    } else {
        waitForJQuery(init);
    }

})(window);