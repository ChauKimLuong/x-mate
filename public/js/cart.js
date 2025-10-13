//@ts-nocheck
;(function () {
  var cartBody = document.getElementById('cart-body')
  var checkAll = document.getElementById('chk-all')
  var deleteSelected = document.getElementById('btnDeleteSelected')
  var couponList = document.getElementById('coupon-list')

  function updateDeleteState() {
    if (!cartBody || !deleteSelected) return
    var itemCheckboxes = cartBody.querySelectorAll('input[type="checkbox"][data-item]')
    var checkedItems = cartBody.querySelectorAll('input[type="checkbox"][data-item]:checked')
    deleteSelected.disabled = checkedItems.length === 0

    if (checkAll) {
      checkAll.checked =
        itemCheckboxes.length > 0 && checkedItems.length === itemCheckboxes.length
    }
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
    deleteSelected.addEventListener('click', function () {
      if (deleteSelected.disabled) return
      alert('Tính năng xóa nhiều sản phẩm sẽ được cập nhật trong phiên bản sau.')
    })
  }

  if (couponList) {
    couponList.addEventListener('click', function (event) {
      var target = event.target
      var ticket = target.closest('.ticket')
      if (!ticket || ticket.classList.contains('is-disabled')) return
      couponList
        .querySelectorAll('.ticket')
        .forEach(function (node) {
          node.classList.remove('selected')
        })
      ticket.classList.add('selected')
      var input = document.getElementById('coupon')
      if (input && ticket.dataset.code) {
        input.value = ticket.dataset.code
      }
    })
  }

  updateDeleteState()
})()
