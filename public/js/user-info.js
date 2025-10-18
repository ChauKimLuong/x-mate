// Mở modal
document.querySelectorAll('[data-open]').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-open'); // ví dụ "#modal-info"
        const modal = document.querySelector(target);
        if (!modal) return;

        // Đóng modal khác nếu có
        // document.querySelectorAll('.modal.is-open').forEach(m => m.classList.remove('is-open'));

        modal.classList.add('is-open');
        document.body.classList.add('modal-lock');
    });
});

// Đóng modal khi bấm overlay hoặc nút close
document.addEventListener('click', e => {
    if (e.target.matches('[data-close], .modal__overlay')) {
        const modal = e.target.closest('.modal');
        if (modal) {
            modal.classList.remove('is-open');
            document.body.classList.remove('modal-lock');
        }
    }
});
