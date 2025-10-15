//@ts-nocheck
(function () {
  var mainImage = document.getElementById('mainImage');
  if (!mainImage) return;

  var thumbs = document.querySelectorAll('.gallery__thumbs button');
  thumbs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var src = btn.getAttribute('data-src');
      if (src) {
        mainImage.src = src;
      }
      thumbs.forEach(function (b) { b.parentElement.classList.remove('is-active'); });
      btn.parentElement.classList.add('is-active');
    });
  });

  document.querySelectorAll('.swatches button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.swatches button').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
    });
  });

  document.querySelectorAll('.sizes button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.sizes button').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
    });
  });

  var qtyInput = document.getElementById('qty');
  if (!qtyInput) return;

  document.querySelectorAll('.qty-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var action = btn.getAttribute('data-action');
      var current = parseInt(qtyInput.value, 10) || 1;
      if (action === 'increase') {
        qtyInput.value = current + 1;
      } else if (action === 'decrease' && current > 1) {
        qtyInput.value = current - 1;
      }
    });
  });
})();
