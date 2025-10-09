(function () {
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
})();
