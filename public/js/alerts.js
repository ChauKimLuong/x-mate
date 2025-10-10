// /public/js/address.js
// @ts-nocheck

// Không dùng bundler. Siêu gọn: mở/đóng modal + đổ Tỉnh/Huyện/Xã từ API

document.addEventListener('DOMContentLoaded', () => {
  // ---- Modal wiring ----
  const openBtn   = document.querySelector('[data-open-address-modal]');
  const modal     = document.querySelector('[data-address-modal]');
  const overlay   = document.querySelector('[data-address-overlay]');
  const closeBtns = document.querySelectorAll('[data-close-address-modal]');

  const openModal = () => {
    if (!modal || !overlay) return;
    document.body.classList.add('modal-open');
    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
  };
  const closeModal = () => {
    if (!modal || !overlay) return;
    document.body.classList.remove('modal-open');
    modal.classList.add('hidden');
    overlay.classList.add('hidden');
  };

  openBtn?.addEventListener('click', openModal);
  overlay?.addEventListener('click', closeModal);
  closeBtns.forEach(b => b.addEventListener('click', closeModal));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // ---- Province/District/Ward ----
  const provinceSelect = document.getElementById('province');
  const districtSelect = document.getElementById('district');
  const wardSelect     = document.getElementById('ward');

  if (!provinceSelect || !districtSelect || !wardSelect) return;

  let data = []; // [{ name, districts: [{ name, wards: [{ name }] }] }]

  const resetSelect = (el, placeholder) => {
    el.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = '';
    opt.disabled = true;
    opt.selected = true;
    opt.textContent = placeholder;
    el.appendChild(opt);
  };
  const fillOptions = (el, items) => {
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.name;
      opt.textContent = item.name;
      el.appendChild(opt);
    });
  };

  // Tải dữ liệu
  (async () => {
    resetSelect(provinceSelect, '-- Chọn Tỉnh / Thành phố --');
    resetSelect(districtSelect, '-- Chọn Quận / Huyện --');
    resetSelect(wardSelect, '-- Chọn Xã / Phường --');

    try {
      const res = await fetch('https://provinces.open-api.vn/api/?depth=3');
      data = await res.json();
      fillOptions(provinceSelect, data);
    } catch (e) {
      console.error('Lỗi tải danh sách tỉnh/huyện/xã:', e);
    }
  })();

  provinceSelect.addEventListener('change', () => {
    const p = data.find(x => x.name === provinceSelect.value);
    resetSelect(districtSelect, '-- Chọn Quận / Huyện --');
    resetSelect(wardSelect, '-- Chọn Xã / Phường --');
    if (p?.districts) fillOptions(districtSelect, p.districts);
  });

  districtSelect.addEventListener('change', () => {
    const p = data.find(x => x.name === provinceSelect.value);
    const d = p?.districts?.find(x => x.name === districtSelect.value);
    resetSelect(wardSelect, '-- Chọn Xã / Phường --');
    if (d?.wards) fillOptions(wardSelect, d.wards);
  });

  // Chống double submit (tùy thích)
  const form = document.querySelector('[data-address-form]');
  form?.addEventListener('submit', () => {
    const btn = form.querySelector('button[type="submit"]');
    btn?.setAttribute('disabled', 'disabled');
    btn?.classList.add('is-loading');
  });
});
