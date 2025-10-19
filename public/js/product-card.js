//@ts-nocheck
;(function () {
  var cards = document.querySelectorAll('.product-card')
  if (!cards.length) return

  var cartBadge = document.querySelector('.cart__badge')

  function updateCartBadge(count) {
    if (!cartBadge) {
      cartBadge = document.querySelector('.cart__badge')
    }
    if (cartBadge && typeof count === 'number' && !Number.isNaN(count)) {
      var normalized = Math.max(0, Math.floor(count))
      if (normalized > 0) {
        cartBadge.textContent = String(normalized)
        cartBadge.style.display = ''
      } else {
        cartBadge.textContent = ''
        cartBadge.style.display = 'none'
      }
    }
  }

  function cacheDefaultImages(card) {
    var primary = card.querySelector('.product-thumb:not(.product-thumb--hover)')
    var hover = card.querySelector('.product-thumb--hover')
    if (primary && !primary.dataset.originalSrc) {
      primary.dataset.originalSrc = primary.getAttribute('src') || ''
    }
    if (hover && !hover.dataset.originalSrc) {
      hover.dataset.originalSrc = hover.getAttribute('src') || ''
    }
    if (primary) {
      var defaultImage = primary.dataset.originalSrc || primary.getAttribute('src') || ''
      card.dataset.defaultImage = defaultImage
      if (!card.getAttribute('data-product-image') && defaultImage) {
        card.setAttribute('data-product-image', defaultImage)
      }
    }
    if (hover) {
      card.dataset.defaultHover =
        hover.dataset.originalSrc || hover.getAttribute('src') || ''
    }
  }

  function applyColorImage(card, imageUrl) {
    var primary = card.querySelector('.product-thumb:not(.product-thumb--hover)')
    var hover = card.querySelector('.product-thumb--hover')
    var normalized = typeof imageUrl === 'string' ? imageUrl.trim() : ''

    if (normalized) {
      if (primary) {
        primary.setAttribute('src', normalized)
      }
      if (hover) {
        hover.setAttribute('src', normalized)
      }
      card.setAttribute('data-product-image', normalized)
      return
    }

    var fallback = card.dataset.defaultImage || (primary && primary.dataset.originalSrc) || ''
    var hoverFallback =
      card.dataset.defaultHover ||
      (hover && hover.dataset.originalSrc) ||
      fallback

    if (primary && fallback) {
      primary.setAttribute('src', fallback)
    }
    if (hover && hoverFallback) {
      hover.setAttribute('src', hoverFallback)
    }
    if (fallback) {
      card.setAttribute('data-product-image', fallback)
    }
  }

  function setSelectedColor(card, button) {
    var swatches = card.querySelectorAll('.swatch')
    swatches.forEach(function (item) {
      item.classList.remove('is-active')
    })
    button.classList.add('is-active')

    var color = button.getAttribute('data-color')
    if (color) {
      card.setAttribute('data-selected-color', color)
    } else {
      card.removeAttribute('data-selected-color')
    }

    var colorImage = button.getAttribute('data-color-image') || ''
    applyColorImage(card, colorImage)
  }

  function getSelectedColor(card) {
    var color = card.getAttribute('data-selected-color')
    if (color && color.trim() !== '') {
      return color
    }
    var active = card.querySelector('.swatch.is-active')
    return active ? active.getAttribute('data-color') || null : null
  }

  function ensureFeedbackNode(card) {
    var quickAdd = card.querySelector('.quick-add')
    if (!quickAdd) return null
    var node = quickAdd.querySelector('.quick-add__feedback')
    if (!node) {
      node = document.createElement('div')
      node.className = 'quick-add__feedback'
      quickAdd.appendChild(node)
    }
    return node
  }

  function showFeedback(card, message, isError) {
    var feedback = ensureFeedbackNode(card)
    if (!feedback || !message) return
    feedback.textContent = message
    feedback.classList.toggle('is-error', !!isError)
    feedback.classList.add('is-visible')
    clearTimeout(feedback._hideTimer)
    feedback._hideTimer = setTimeout(function () {
      feedback.classList.remove('is-visible')
    }, 2200)
  }

  function parseResponse(response) {
    return response
      .json()
      .catch(function () {
        return {}
      })
      .then(function (data) {
        return { ok: response.ok, status: response.status, data: data }
      })
  }

  function handleQuickAdd(card, button) {
    var size = button.getAttribute('data-size')
    if (!size) {
      showFeedback(card, 'Vui long chon size hop le.', true)
      return
    }

    var productId = card.getAttribute('data-product-id') || ''
    if (!productId) {
      showFeedback(card, 'Khong tim thay ma san pham.', true)
      return
    }

    var payload = {
      productId: productId,
      slug: card.getAttribute('data-product-slug') || '',
      title: card.getAttribute('data-product-title') || '',
      price: Number(card.getAttribute('data-product-price') || 0),
      size: size,
      color: getSelectedColor(card),
      quantity: 1,
      image: card.getAttribute('data-product-image') || '',
    }

    button.disabled = true
    button.classList.add('is-loading')
    showFeedback(card, 'Dang them vao gio hang...', false)

    fetch('/cart/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(payload),
    })
      .then(parseResponse)
      .then(function (result) {
        if (!result) return
        if (result.ok && result.data && result.data.success) {
          updateCartBadge(result.data.cartQuantity)
          showFeedback(card, 'Da them vao gio hang!', false)
        } else {
          var message =
            (result && result.data && result.data.message) ||
            'Khong the them vao gio hang.'
          showFeedback(card, message, true)
        }
      })
      .catch(function () {
        showFeedback(card, 'Co loi xay ra. Vui long thu lai.', true)
      })
      .finally(function () {
        button.disabled = false
        button.classList.remove('is-loading')
      })
  }

  cards.forEach(function (card) {
    cacheDefaultImages(card)
    var initial = card.querySelector('.swatch.is-active')
    if (initial) {
      var colorValue = initial.getAttribute('data-color')
      if (colorValue) {
        card.setAttribute('data-selected-color', colorValue)
      }
      var initialImage = initial.getAttribute('data-color-image') || ''
      if (initialImage) {
        applyColorImage(card, initialImage)
      }
    } else if (card.dataset.defaultImage) {
      card.setAttribute('data-product-image', card.dataset.defaultImage)
    }

    card.querySelectorAll('.swatch').forEach(function (button) {
      button.addEventListener('click', function () {
        setSelectedColor(card, button)
      })
    })

    card.querySelectorAll('.quick-add__btn').forEach(function (button) {
      button.addEventListener('click', function () {
        handleQuickAdd(card, button)
      })
    })
  })
})()
