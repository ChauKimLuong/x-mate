//@ts-nocheck
;(function () {
  var cartBody = document.getElementById('cart-body')
  var checkAll = document.getElementById('chk-all')
  var deleteSelected = document.getElementById('btnDeleteSelected')
  var couponList = document.getElementById('coupon-list')
  var couponInput = document.getElementById('coupon')
  var btnCoupon = document.getElementById('btnCoupon')
  var btnCheckout = document.getElementById('btnCheckout')

  var discountNode = document.getElementById('discount')
  var shippingNode = document.getElementById('shipping')
  var totalNode = document.getElementById('total')
  var shipBadge = document.getElementById('ship-badge')
  var freeShipStatusNode = document.getElementById('fs-right')

  var baseTotals =
    window.__CART_BASE_TOTALS && Object.keys(window.__CART_BASE_TOTALS).length
      ? window.__CART_BASE_TOTALS
      : null
  var baseFreeShip = window.__CART_BASE_FREESHIP || {}
  var baseFreeShipStatus =
    freeShipStatusNode && typeof freeShipStatusNode.textContent === 'string'
      ? freeShipStatusNode.textContent
      : ''
  var canUseVoucher =
    typeof window.__CART_CAN_USE_VOUCHER === 'boolean'
      ? window.__CART_CAN_USE_VOUCHER
      : true

  var activeVoucher = window.__CART_ACTIVE_VOUCHER || null

  if (!canUseVoucher) {
    if (couponInput) {
      couponInput.disabled = true
      couponInput.value = ''
    }
    if (btnCoupon) {
      btnCoupon.disabled = true
    }
    if (couponList) {
      couponList.classList.add('is-disabled')
    }
  }

  function updateDeleteState() {
    if (!cartBody || !deleteSelected) return
    var itemCheckboxes = cartBody.querySelectorAll(
      'input[type="checkbox"][data-item]'
    )
    var checkedItems = cartBody.querySelectorAll(
      'input[type="checkbox"][data-item]:checked'
    )
    deleteSelected.disabled = checkedItems.length === 0

    if (checkAll) {
      checkAll.checked =
        itemCheckboxes.length > 0 &&
        checkedItems.length === itemCheckboxes.length
    }
  }

  function formatCurrency(value) {
    var amount = Number(value) || 0
    if (amount < 0) amount = 0
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(Math.round(amount))
  }

  function formatDiscount(amount) {
    var normalized = Number(amount) || 0
    if (normalized <= 0) return formatCurrency(0)
    return '- ' + formatCurrency(normalized)
  }

  function applySummary(summary) {
    if (!summary || !baseTotals) return
    if (discountNode)
      discountNode.textContent = formatDiscount(summary.discount)
    if (shippingNode)
      shippingNode.textContent = formatCurrency(summary.shipping)
    if (totalNode) totalNode.textContent = formatCurrency(summary.total)

    if (shipBadge) {
      shipBadge.hidden = !(summary.shipping <= 0)
    }

    if (freeShipStatusNode) {
      if (
        summary.shipping <= 0 &&
        baseTotals.shipping > 0 &&
        summary.couponType === 'FREESHIP'
      ) {
        freeShipStatusNode.textContent =
          'Đã áp dụng mã miễn phí vận chuyển.'
      } else {
        freeShipStatusNode.textContent =
          baseFreeShip.statusText || baseFreeShipStatus || ''
      }
    }
  }

  function applyServerTotals(response) {
    if (!response || !response.totals) return
    var totals = response.totals

    baseTotals = {
      quantity: totals.quantity || 0,
      subtotal: totals.subtotal || 0,
      subtotalText: totals.subtotalText || formatCurrency(totals.subtotal || 0),
      discount: totals.discount || 0,
      discountText:
        totals.discountText || formatDiscount(totals.discount || 0),
      shipping: totals.shipping || 0,
      shippingText: totals.shippingText || formatCurrency(totals.shipping || 0),
      totalBeforeShipping: totals.totalBeforeShipping || 0,
      totalBeforeShippingText:
        totals.totalBeforeShippingText ||
        formatCurrency(totals.totalBeforeShipping || 0),
      total: totals.total || 0,
      totalText: totals.totalText || formatCurrency(totals.total || 0)
    }
    window.__CART_BASE_TOTALS = baseTotals

    activeVoucher = response.coupon
      ? { code: response.coupon.code, type: response.coupon.type }
      : null
    window.__CART_ACTIVE_VOUCHER = activeVoucher

    applySummary({
      discount: Number(baseTotals.discount || 0),
      shipping: Number(baseTotals.shipping || 0),
      total: Number(baseTotals.total || 0),
      couponType: activeVoucher ? activeVoucher.type : null
    })

    if (discountNode) discountNode.textContent = baseTotals.discountText
    if (shippingNode) shippingNode.textContent = baseTotals.shippingText
    if (totalNode) totalNode.textContent = baseTotals.totalText

    if (canUseVoucher && couponInput) {
      couponInput.value = activeVoucher ? activeVoucher.code : ''
    }
    markSelectedTicket(canUseVoucher && activeVoucher ? activeVoucher.code : null)
  }

  function resetSummary() {
    if (!baseTotals) return
    applyServerTotals({
      totals: baseTotals,
      coupon: activeVoucher
        ? { code: activeVoucher.code, type: activeVoucher.type }
        : null
    })
  }

  function markSelectedTicket(code) {
    if (!couponList) return
    var targetCode = code ? code.toLowerCase() : ''
    couponList.querySelectorAll('.ticket').forEach(function (ticket) {
      var ticketCode = (ticket.dataset.code || '').toLowerCase()
      if (targetCode && ticketCode === targetCode) {
        ticket.classList.add('selected')
      } else {
        ticket.classList.remove('selected')
      }
    })
  }

  function setCouponLoading(isLoading) {
    if (!canUseVoucher) return
    if (btnCoupon) btnCoupon.disabled = isLoading
    if (couponList) {
      if (isLoading) {
        couponList.classList.add('is-disabled')
      } else {
        couponList.classList.remove('is-disabled')
      }
    }
  }

  function applyCouponRequest(code) {
    return fetch('/cart/coupon', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ couponCode: code || '' })
    })
      .then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok || !data.success) {
            throw new Error(
              data && data.message ? data.message : 'Không thể áp dụng mã giảm giá.'
            )
          }
          return data
        })
      })
  }

  function handleTicketClick(event) {
    if (!canUseVoucher) return
    var ticket = event.target.closest('.ticket')
    if (!ticket || ticket.classList.contains('is-disabled')) return
    var code = ticket.dataset.code || ''
    var alreadySelected = ticket.classList.contains('selected')
    var targetCode = alreadySelected ? '' : code

    setCouponLoading(true)
    applyCouponRequest(targetCode)
      .then(function (data) {
        applyServerTotals(data)
      })
      .catch(function (error) {
        console.error('APPLY COUPON ERROR:', error)
        alert(error && error.message ? error.message : 'Không thể áp dụng mã giảm giá.')
        markSelectedTicket(
          canUseVoucher && activeVoucher ? activeVoucher.code : null
        )
        if (canUseVoucher && couponInput)
          couponInput.value = activeVoucher ? activeVoucher.code : ''
      })
      .finally(function () {
        setCouponLoading(false)
      })
  }

  function handleApplyButton() {
    if (!canUseVoucher || !couponInput) return
    var value = couponInput.value ? couponInput.value.trim() : ''
    setCouponLoading(true)
    applyCouponRequest(value)
      .then(function (data) {
        applyServerTotals(data)
      })
      .catch(function (error) {
        console.error('APPLY COUPON ERROR:', error)
        alert(error && error.message ? error.message : 'Không thể áp dụng mã giảm giá.')
        if (canUseVoucher && couponInput)
          couponInput.value = activeVoucher ? activeVoucher.code || '' : ''
        markSelectedTicket(
          canUseVoucher && activeVoucher ? activeVoucher.code : null
        )
      })
      .finally(function () {
        setCouponLoading(false)
      })
  }

  if (checkAll) {
    checkAll.addEventListener('change', function () {
      if (!cartBody) return
      var rows = cartBody.querySelectorAll('input[type="checkbox"][data-item]')
      rows.forEach(function (checkbox) {
        checkbox.checked = checkAll.checked
      })
      updateDeleteState()
    })
  }

  if (cartBody) {
    cartBody.addEventListener('change', function (event) {
      var target = event.target
      if (
        target &&
        target.matches &&
        target.matches('input[type="checkbox"][data-item]')
      ) {
        updateDeleteState()
      }
    })
  }

  if (deleteSelected) {
    deleteSelected.addEventListener('click', function (event) {
      if (deleteSelected.disabled) {
        event.preventDefault()
      }
    })
  }

  if (canUseVoucher && couponList) {
    couponList.addEventListener('click', handleTicketClick)
  }

  if (canUseVoucher && btnCoupon) {
    btnCoupon.addEventListener('click', handleApplyButton)
  }

  function prepareCheckout() {
    var payload = {}
    if (
      canUseVoucher &&
      window.__CART_ACTIVE_VOUCHER &&
      window.__CART_ACTIVE_VOUCHER.code
    ) {
      payload.couponCode = window.__CART_ACTIVE_VOUCHER.code
    }

    return fetch('/cart/prepare-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok || !data.success) {
          throw new Error(
            data && data.message ? data.message : 'Không thể chuẩn bị thanh toán.'
          )
        }
        return data
      })
    })
  }

  if (btnCheckout) {
    btnCheckout.addEventListener('click', function (event) {
      event.preventDefault()
      prepareCheckout()
        .then(function (data) {
          var target = (data && data.redirect) || '/checkout'
          window.location.href = target
        })
        .catch(function (error) {
          console.error('Prepare checkout error:', error)
          alert(
            error && error.message
              ? error.message
              : 'Không thể chuyển tới trang thanh toán.'
          )
        })
    })
  }

  updateDeleteState()
  applyServerTotals({
    totals: baseTotals || {},
    coupon: activeVoucher
      ? { code: activeVoucher.code, type: activeVoucher.type }
      : null
  })
})()
