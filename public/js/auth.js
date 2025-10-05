(function () {
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
})();
