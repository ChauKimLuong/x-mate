// address.js (siêu gọn)
// @ts-nocheck

// Yêu cầu trong trang có 3 select: #province, #district, #ward
// Dữ liệu lấy từ API công khai: https://provinces.open-api.vn/api/?depth=3

document.addEventListener('DOMContentLoaded', () => {
    const provinceSelect = document.getElementById('province');
    const districtSelect = document.getElementById('district');
    const wardSelect = document.getElementById('ward');

    let data = []; // [{ name, districts: [{ name, wards: [{ name }] }] }]

    // Helper nhỏ
    const resetSelect = (el, placeholder) => {
        el.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = '';
        opt.disabled = true;
        opt.selected = true;
        opt.textContent = placeholder;
        el.appendChild(opt);
    };

    const fillOptions = (el, items, getText = (x) => x.name, getVal = (x) => x.name) => {
        items.forEach((item) => {
            const opt = document.createElement('option');
            opt.value = getVal(item);
            opt.textContent = getText(item);
            el.appendChild(opt);
        });
    };

    // 1) Tải dữ liệu tỉnh/huyện/xã
    const load = async () => {
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
    };

    // 2) Chọn Tỉnh -> đổ Quận
    provinceSelect.addEventListener('change', () => {
        const p = data.find((x) => x.name === provinceSelect.value);
        resetSelect(districtSelect, '-- Chọn Quận / Huyện --');
        resetSelect(wardSelect, '-- Chọn Xã / Phường --');
        if (p && Array.isArray(p.districts)) fillOptions(districtSelect, p.districts);
    });

    // 3) Chọn Quận -> đổ Xã
    districtSelect.addEventListener('change', () => {
        const p = data.find((x) => x.name === provinceSelect.value);
        const d = p?.districts?.find((x) => x.name === districtSelect.value);
        resetSelect(wardSelect, '-- Chọn Xã / Phường --');
        if (d && Array.isArray(d.wards)) fillOptions(wardSelect, d.wards);
    });

    load();
});
