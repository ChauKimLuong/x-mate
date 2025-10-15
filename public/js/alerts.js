// alerts.js
//@ts-nocheck
// Điều khiển hiển thị/ẩn thông báo flash
;(function () {
  const alerts = document.querySelectorAll('[show-alert]')
  if (!alerts.length) return

  const hide = (node) => {
    if (!node || node.classList.contains('alert-hidden')) return

    node.classList.add('alert-hidden')

    const removeAfterTransition = () => {
      if (node.parentElement) {
        node.remove()
      }
    }

    node.addEventListener('transitionend', removeAfterTransition, { once: true })
    setTimeout(removeAfterTransition, 500)
  }

  alerts.forEach((node) => {
    const delayAttr = node.getAttribute('data-time')
    const delay = Number(delayAttr)
    const closeBtn = node.querySelector('[close-alert]')

    if (closeBtn) {
      closeBtn.addEventListener('click', (event) => {
        event.preventDefault()
        hide(node)
      })
    }

    if (!Number.isNaN(delay) && delay > 0) {
      setTimeout(() => hide(node), delay)
    }
  })
})()
