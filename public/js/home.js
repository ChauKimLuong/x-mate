(function () {
    function toggleMenu(e) {
        var btn = e.target.closest('[data-menu-toggle]');
        if (!btn) return;
        var menu = document.querySelector('[data-menu]');
        if (menu) menu.classList.toggle('open');
    }

    function initHeaderScroll() {
        var body = document.body;
        var header = document.querySelector('.site-header');
        if (!header) return;

        var lastState = false;
        var THRESHOLD = 80;

        function update() {
            var y = window.scrollY || window.pageYOffset;
            var next = y > THRESHOLD;
            if (next !== lastState) {
                body.classList.toggle('has-scrolled', next);
                lastState = next;
            }
        }

        var ticking = false;
        window.addEventListener('scroll', function () {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(function () {
                update();
                ticking = false;
            });
        }, { passive: true });

        update();
    }

    function initPasswordToggle() {
        document.querySelectorAll('.auth-password-toggle').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var wrapper = btn.closest('.auth-form__field--password');
                if (!wrapper) return;
                var input = wrapper.querySelector('input');
                if (!input) return;

                var hidden = input.getAttribute('type') === 'password';
                input.setAttribute('type', hidden ? 'text' : 'password');
                btn.classList.toggle('is-active', hidden);
                btn.setAttribute('aria-pressed', hidden ? 'true' : 'false');
            });
        });
    }

    function initAlerts() {
        document.querySelectorAll('[show-alert]').forEach(function (node) {
            var delayAttr = node.getAttribute('data-time');
            var delay = Number(delayAttr);
            var closeBtn = node.querySelector('[close-alert]');

            function hide() {
                node.classList.add('alert-hidden');
            }

            if (!Number.isNaN(delay) && delay > 0) {
                setTimeout(hide, delay);
            }

            if (closeBtn) {
                closeBtn.addEventListener('click', hide);
            }
        });
    }

    document.addEventListener('click', toggleMenu);
    initHeaderScroll();
    initPasswordToggle();
    initAlerts();
})();