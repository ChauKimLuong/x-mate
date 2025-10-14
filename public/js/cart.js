//@ts-nocheck
;(function () {
  var cartBody = document.getElementById('cart-body')
  var checkAll = document.getElementById('chk-all')
  var deleteSelected = document.getElementById('btnDeleteSelected')
  var couponList = document.getElementById('coupon-list')
  var couponInput = document.getElementById('coupon')
  var btnCoupon = document.getElementById('btnCoupon')

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

  var activeVoucher = null

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
    if (discountNode) discountNode.textContent = formatDiscount(summary.discount)
    if (shippingNode) shippingNode.textContent = formatCurrency(summary.shipping)
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

  function resetSummary() {
    if (!baseTotals) return
    applySummary({
      discount: baseTotals.discount || 0,
      shipping: baseTotals.shipping || 0,
      total: baseTotals.total || 0,
      couponType: null
    })
    activeVoucher = null
    window.__CART_ACTIVE_VOUCHER = null
  }

  function parseNumber(value) {
    var num = Number(value)
    return Number.isFinite(num) ? num : 0
  }

  function calculateTotals(ticket) {
    if (!baseTotals || !ticket) return null

    var type = (ticket.dataset.type || '').toUpperCase()
    var discountValue = parseNumber(ticket.dataset.discount)
    var maxDiscount = parseNumber(ticket.dataset.max)
    var minOrderValue = parseNumber(ticket.dataset.min)
    var baseTotalBeforeShipping = baseTotals.totalBeforeShipping || 0

    var couponDiscount = 0
    var shipping = baseTotals.shipping || 0

    if (type === 'PERCENT') {
      couponDiscount = (baseTotalBeforeShipping * discountValue) / 100
      if (maxDiscount > 0) {
        couponDiscount = Math.min(couponDiscount, maxDiscount)
      }
    } else if (
      type === 'VALUE' ||
      type === 'FIXED' ||
      type === 'AMOUNT'
    ) {
      couponDiscount = discountValue
    } else if (type === 'FREESHIP') {
      shipping = 0
      if (discountValue > 0) {
        couponDiscount = discountValue
      }
    } else {
      couponDiscount = discountValue
    }

    if (minOrderValue > 0 && baseTotalBeforeShipping < minOrderValue) {
      couponDiscount = 0
      shipping = baseTotals.shipping || 0
    }

    couponDiscount = Math.max(
      0,
      Math.min(couponDiscount, baseTotalBeforeShipping)
    )

    var totalDiscount = (baseTotals.discount || 0) + couponDiscount
    var totalBeforeShipping = Math.max(
      0,
      baseTotalBeforeShipping - couponDiscount
    )
    var total = totalBeforeShipping + shipping

    return {
      code: ticket.dataset.code || '',
      type: type,
      discountValue: discountValue,
      couponDiscount: couponDiscount,
      totalDiscount: totalDiscount,
      shipping: shipping,
      totalBeforeShipping: totalBeforeShipping,
      total: total
    }
  }

  function selectTicket(ticket) {
    if (!couponList) return

    couponList.querySelectorAll('.ticket').forEach(function (node) {
      node.classList.remove('selected')
    })

    if (!ticket) {
      if (couponInput) couponInput.value = ''
      resetSummary()
      return
    }

    ticket.classList.add('selected')
    if (couponInput && ticket.dataset.code) {
      couponInput.value = ticket.dataset.code
    }

    var totals = calculateTotals(ticket)
    if (!totals) return

    applySummary({
      discount: totals.totalDiscount,
      shipping: totals.shipping,
      total: totals.total,
      couponType: totals.type
    })

    activeVoucher = totals
    window.__CART_ACTIVE_VOUCHER = totals
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

  if (couponList) {
    couponList.addEventListener('click', function (event) {
      var target = event.target
      var ticket =
        target && target.closest ? target.closest('.ticket') : null
      if (!ticket || ticket.classList.contains('is-disabled')) return

      var alreadySelected = ticket.classList.contains('selected')
      if (alreadySelected) {
        ticket.classList.remove('selected')
        selectTicket(null)
        return
      }

      selectTicket(ticket)
    })
  }

  if (btnCoupon) {
    btnCoupon.addEventListener('click', function () {
      if (!couponList) return
      var code = couponInput && couponInput.value ? couponInput.value.trim() : ''
      if (!code) {
        selectTicket(null)
        return
      }
      var lowerCode = code.toLowerCase()
      var match = null
      couponList.querySelectorAll('.ticket').forEach(function (ticket) {
        if (
          !match &&
          !ticket.classList.contains('is-disabled') &&
          (ticket.dataset.code || '').toLowerCase() === lowerCode
        ) {
          match = ticket
        }
      })
      if (match) {
        selectTicket(match)
        match.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    })
  }

  updateDeleteState()
  resetSummary()
})()
