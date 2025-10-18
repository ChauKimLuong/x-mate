//@ts-nocheck
;(function () {
  var mainImage = document.getElementById('mainImage')

  var thumbButtons = document.querySelectorAll('.gallery__thumbs button')
  if (thumbButtons.length && mainImage) {
    thumbButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var src = btn.getAttribute('data-src')
        if (src) {
          mainImage.src = src
        }
        thumbButtons.forEach(function (item) {
          if (item.parentElement) {
            item.parentElement.classList.remove('is-active')
          }
        })
        if (btn.parentElement) {
          btn.parentElement.classList.add('is-active')
        }
      })
    })
  }

  var colorButtons = document.querySelectorAll('.product-detail__swatches button')
  var colorValueLabel = document.querySelector('[data-selected-color]')
  if (colorButtons.length) {
    colorButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        colorButtons.forEach(function (item) {
          item.classList.remove('is-active')
        })
        btn.classList.add('is-active')
        var colorName = btn.getAttribute('data-color-name') || ''
        if (colorValueLabel) {
          colorValueLabel.textContent = colorName
        }
      })
    })
  }

  var sizeButtons = document.querySelectorAll('.product-detail__sizes button')
  var sizeValueLabel = document.querySelector('[data-selected-size]')
  if (sizeButtons.length) {
    sizeButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        sizeButtons.forEach(function (item) {
          item.classList.remove('is-active')
        })
        btn.classList.add('is-active')
        var sizeValue = btn.getAttribute('data-size') || ''
        if (sizeValueLabel) {
          sizeValueLabel.textContent = sizeValue
        }
      })
    })
  }

  var qtyInput = document.getElementById('qty')
  if (qtyInput) {
    document.querySelectorAll('.qty-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-action')
        var current = parseInt(qtyInput.value, 10) || 1
        if (action === 'increase') {
          qtyInput.value = current + 1
        } else if (action === 'decrease' && current > 1) {
          qtyInput.value = current - 1
        }
      })
    })
  }

  function getQuantity() {
    if (!qtyInput) return 1
    var value = parseInt(qtyInput.value, 10)
    if (!Number.isFinite(value) || value <= 0) return 1
    return value
  }

  var addToCartBtn = document.querySelector('[data-action="add-to-cart"]')
  if (!addToCartBtn) return

  addToCartBtn.addEventListener('click', function () {
    if (addToCartBtn.disabled) return

    var productId = addToCartBtn.getAttribute('data-product-id') || ''
    if (!productId) {
      alert('Không xác định được sản phẩm.')
      return
    }

    var slug = addToCartBtn.getAttribute('data-product-slug') || ''
    var title = addToCartBtn.getAttribute('data-product-title') || ''
    var imageSrc = addToCartBtn.getAttribute('data-product-image') || ''
    if (mainImage) {
      imageSrc = mainImage.getAttribute('src') || imageSrc
    }

    var selectedColorBtn = document.querySelector(
      '.product-detail__swatches button.is-active'
    )
    var colorName = selectedColorBtn
      ? selectedColorBtn.getAttribute('data-color-name')
      : null

    var selectedSizeBtn = document.querySelector(
      '.product-detail__sizes button.is-active'
    )
    var sizeValue = selectedSizeBtn
      ? selectedSizeBtn.getAttribute('data-size')
      : null

    var quantity = getQuantity()

    addToCartBtn.disabled = true

    fetch('/cart/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        productId: productId,
        slug: slug,
        title: title,
        size: sizeValue || undefined,
        color: colorName || undefined,
        quantity: quantity,
        image: imageSrc || undefined
      })
    })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return null
          })
          .then(function (data) {
            if (!response.ok || !data || data.success === false) {
              var message =
                (data && data.message) || 'Không thể thêm sản phẩm vào giỏ hàng.'
              throw new Error(message)
            }
            if (typeof data.cartQuantity === 'number') {
              var badge = document.querySelector('.cart__badge')
              if (badge) {
                badge.textContent = data.cartQuantity
              }
            }
            alert(data.message || 'Đã thêm sản phẩm vào giỏ hàng.')
          })
      })
      .catch(function (error) {
        console.error('ADD_TO_CART_ERROR:', error)
        alert(
          error && error.message
            ? error.message
            : 'Không thể thêm sản phẩm vào giỏ hàng.'
        )
      })
      .finally(function () {
        addToCartBtn.disabled = false
      })
  })
})()
