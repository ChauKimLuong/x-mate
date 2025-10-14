//@ts-nocheck
;(function () {
  var state = window.__CHECKOUT_STATE || { totals: {} }
  var addresses = window.__CHECKOUT_ADDRESSES || []

  var payRadios = document.querySelectorAll('input[name="paymentMethod"]')
  var dockPayChip = document.getElementById('dockPayChip')
  var dockCoupon = document.getElementById('dockCoupon')
  var dockTotal = document.getElementById('dockTotal')
  var summaryTotal = document.getElementById('p-total')
  var summaryDiscount = document.getElementById('p-discount')

  var addressPickerOpen = document.querySelector('[data-address-picker-open]')
  var addressPickerOverlay = document.querySelector('[data-address-picker-overlay]')
  var addressPickerModal = document.querySelector('[data-address-picker-modal]')
  var addressPickerClose = document.querySelector('[data-address-picker-close]')

  var fieldMap = {
    fullName: document.querySelector('[data-field="fullName"]'),
    phone: document.querySelector('[data-field="phone"]'),
    line1: document.querySelector('[data-field="line1"]'),
    city: document.querySelector('[data-field="city"]'),
    district: document.querySelector('[data-field="district"]'),
    ward: document.querySelector('[data-field="ward"]'),
    note: document.querySelector('[data-field="note"]')
  }

  function formatMoney(value) {
    var number = Number(value) || 0
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(number)
  }

  function updateTotalDisplay(totalText) {
    if (dockTotal) dockTotal.textContent = totalText
    if (summaryTotal) summaryTotal.textContent = totalText
  }

  function updatePayChip() {
    if (!payRadios || !dockPayChip) return
    var checked = Array.prototype.find.call(payRadios, function (radio) {
      return radio.checked
    })
    dockPayChip.textContent = checked ? checked.value : ''
  }

  function fillAddress(address) {
    if (!address) return
    if (fieldMap.fullName) fieldMap.fullName.value = address.fullName || ''
    if (fieldMap.phone) fieldMap.phone.value = address.phone || ''
    if (fieldMap.line1) fieldMap.line1.value = address.line1 || ''
    if (fieldMap.city) fieldMap.city.value = address.city || ''
    if (fieldMap.district) fieldMap.district.value = address.district || ''
    if (fieldMap.ward) fieldMap.ward.value = address.ward || ''
    if (fieldMap.note) fieldMap.note.value = address.note || ''
  }

  function toggleAddressPicker(show) {
    if (!addressPickerModal || !addressPickerOverlay) return
    if (show) {
      addressPickerModal.classList.remove('hidden')
      addressPickerOverlay.classList.remove('hidden')
      document.body.classList.add('is-modal-open')
    } else {
      addressPickerModal.classList.add('hidden')
      addressPickerOverlay.classList.add('hidden')
      document.body.classList.remove('is-modal-open')
    }
  }

  function attachAddressPickers() {
    var buttons = addressPickerModal
      ? addressPickerModal.querySelectorAll('[data-address-pick]')
      : []
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var selected = {
          id: btn.getAttribute('data-id'),
          fullName: btn.getAttribute('data-full-name') || '',
          phone: btn.getAttribute('data-phone') || '',
          line1: btn.getAttribute('data-line1') || '',
          city: btn.getAttribute('data-city') || '',
          district: btn.getAttribute('data-district') || '',
          ward: btn.getAttribute('data-ward') || ''
        }
        fillAddress(selected)
        toggleAddressPicker(false)
      })
    })
  }

  if (payRadios && payRadios.length) {
    payRadios.forEach(function (radio) {
      radio.addEventListener('change', updatePayChip)
    })
    updatePayChip()
  }

  if (dockCoupon) {
    if (state && state.coupon && state.coupon.code) {
      dockCoupon.textContent = state.coupon.code
    } else {
      dockCoupon.textContent = 'chưa áp dụng'
    }
  }

  if (summaryDiscount && state && state.totals) {
    summaryDiscount.textContent =
      state.totals.discountText || formatMoney(state.totals.discount || 0)
  }

  if (state && state.totals) {
    updateTotalDisplay(state.totals.totalText || formatMoney(state.totals.total || 0))
  } else {
    updateTotalDisplay(formatMoney(0))
  }

  var defaultAddress =
    (state && state.address) ||
    (addresses && addresses.length
      ? addresses.find(function (addr) {
          return addr && addr.isDefault
        }) || addresses[0]
      : null)

  if (defaultAddress) {
    fillAddress(defaultAddress)
  }

  if (addressPickerOpen) {
    addressPickerOpen.addEventListener('click', function () {
      toggleAddressPicker(true)
    })
  }

  if (addressPickerOverlay) {
    addressPickerOverlay.addEventListener('click', function () {
      toggleAddressPicker(false)
    })
  }

  if (addressPickerClose) {
    addressPickerClose.addEventListener('click', function () {
      toggleAddressPicker(false)
    })
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      toggleAddressPicker(false)
    }
  })

  attachAddressPickers()
})()
