(function ($) {
    function initPageFeatures() {
        var lazyLoadOptions = {
            scrollDirection: 'vertical',
            effect: 'fadeIn',
            effectTime: 300,
            placeholder: "",
            onError: function (element) {
                console.log('[lazyload] Error loading ' + element.data('src'));
            },
            afterLoad: function (element) {
                if (element.is('img')) {
                    element.css('background-image', 'none');
                    element.css('min-height', '0');
                } else if (element.is('div')) {
                    element.css('background-size', 'cover');
                    element.css('background-position', 'center');
                }
                if ($('body').data('bs.scrollspy')) {
                    $('body').scrollspy('refresh');
                }
            }
        };

        $('img.lazy, div.lazy:not(.always-load)').Lazy({ visibleOnly: true, ...lazyLoadOptions });
        $('div.lazy.always-load').Lazy({ visibleOnly: false, ...lazyLoadOptions });

        $('[data-toggle="tooltip"]').tooltip();

        var $grid = $('.grid');
        if ($grid.length) {
            $grid.masonry({
                percentPosition: true,
                itemSelector: '.grid-item',
                columnWidth: '.grid-sizer'
            });

            $grid.imagesLoaded().progress(function () {
                $grid.masonry('layout');
            });

            $(".lazy").on("load", function () {
                $grid.masonry('layout');
            });
        }

        var $navYear = $('#navbar-year');
        if ($navYear.length) {
            $('body').scrollspy({ target: '#navbar-year', offset: 100 });
            $('body').scrollspy('refresh');
        } else {
            // Clean up scrollspy if we left the page to avoid errors
            if ($('body').data('bs.scrollspy')) {
                $('body').scrollspy('dispose');
            }
        }

        if (typeof renderMathInElement !== 'undefined') {
            renderMathInElement(document.body, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ],
                throwOnError : false
            });
        }
    }

    function updateNavbarActive() {
        var path = window.location.pathname.replace(/\/index\.html$/, '') || '/';
        var items = document.querySelectorAll('.navbar .nav-item');
        items.forEach(function (item) { item.classList.remove('active'); });
        var links = document.querySelectorAll('.navbar .nav-link');
        var matched = false;
        links.forEach(function (link) {
            var href = link.getAttribute('href');
            if (!href) return;
            var normalized = href.replace(/\/index\.html$/, '') || '/';
            if (normalized === path) {
                var li = link.closest('.nav-item');
                if (li) li.classList.add('active');
                matched = true;
            }
        });
        if (!matched) {
            var home = document.querySelector('.navbar .nav-link[href="/"]');
            if (home) {
                var li = home.closest('.nav-item');
                if (li) li.classList.add('active');
            }
        }
    }

    function initPjax() {
        if (!$.pjax) return;
        $(document).pjax('a[href^="/"]:not([data-no-pjax]):not([target])', '#pjax-container', {
            fragment: '#pjax-container',
            timeout: 8000
        });
    }

    var progressTimer = null;

    function startProgress() {
        var bar = document.getElementById('pjax-progress');
        if (!bar) return;
        bar.style.opacity = '1';
        bar.style.width = '0%';
        var width = 0;
        clearInterval(progressTimer);
        progressTimer = setInterval(function () {
            width = Math.min(width + 10, 80);
            bar.style.width = width + '%';
        }, 120);
    }

    function endProgress() {
        var bar = document.getElementById('pjax-progress');
        if (!bar) return;
        clearInterval(progressTimer);
        bar.style.width = '100%';
        setTimeout(function () {
            bar.style.opacity = '0';
            bar.style.width = '0%';
        }, 250);
    }

    $(document).ready(function () {
        initPageFeatures();
        initPjax();
        updateNavbarActive();
        $(document).on('click', '.navbar-collapse .nav-link', function () {
            var $toggler = $('.navbar-toggler');
            if ($toggler.is(':visible')) {
                $('#navbarResponsive').collapse('hide');
            }
        });
    });

    $(document).on('pjax:send', function () {
        startProgress();
        if (window.MusicPlayer && typeof window.MusicPlayer.stash === 'function') {
            window.MusicPlayer.stash();
        }
    });

    $(document).on('pjax:end', function () {
        endProgress();
        initPageFeatures();
        updateNavbarActive();
        if (window.MusicPlayer && typeof window.MusicPlayer.mount === 'function') {
            window.MusicPlayer.mount();
        }
    });
})(jQuery);
