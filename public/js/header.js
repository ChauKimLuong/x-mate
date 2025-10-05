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

  document.addEventListener('click', toggleMenu);
  initHeaderScroll();
})();
