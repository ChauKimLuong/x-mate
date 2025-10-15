// address.js
//@ts-nocheck
// Quản lý modal địa chỉ + load danh sách tỉnh/thành

document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.querySelector("[data-address-overlay]");
  const modal = document.querySelector("[data-address-modal]");
  const openBtn = document.querySelector("[data-open-address-modal]");
  const closeBtn = document.querySelector("[data-close-address-modal]");
  const form = document.querySelector("[data-address-form]");
  const submitBtn = form?.querySelector(".btn--primary");
  const modalTitle = modal?.querySelector(".address-modal__title");
  const idField = form?.querySelector("[data-address-id-field]");
  const defaultCheckbox = form?.querySelector("#is_default");
  const fullNameInput = form?.querySelector("#full_name");
  const phoneInput = form?.querySelector("#phone");
  const line1Input = form?.querySelector("#line1");
  const editButtons = Array.from(
    document.querySelectorAll("[data-edit-address]")
  );

  const provinceSelect = document.getElementById("province");
  const districtSelect = document.getElementById("district");
  const wardSelect = document.getElementById("ward");

  const placeholders = {
    province: "-- Chọn Tỉnh / Thành phố --",
    district: "-- Chọn Quận / Huyện --",
    ward: "-- Chọn Xã / Phường --",
  };

  let locationData = [];
  let pendingLocation = null;

  const resetSelect = (el, placeholder) => {
    if (!el) return;
    el.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.disabled = true;
    opt.selected = true;
    opt.textContent = placeholder;
    el.appendChild(opt);
  };

  const fillOptions = (el, items) => {
    if (!el || !Array.isArray(items)) return;
    items.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.name;
      opt.textContent = item.name;
      el.appendChild(opt);
    });
  };

  const fillProvinces = () => {
    resetSelect(provinceSelect, placeholders.province);
    fillOptions(provinceSelect, locationData);
  };

  const fillDistricts = (provinceName) => {
    resetSelect(districtSelect, placeholders.district);
    resetSelect(wardSelect, placeholders.ward);
    if (!provinceName) return;

    const province = locationData.find((x) => x.name === provinceName);
    fillOptions(districtSelect, province?.districts ?? []);
  };

  const fillWards = (provinceName, districtName) => {
    resetSelect(wardSelect, placeholders.ward);
    if (!provinceName || !districtName) return;

    const province = locationData.find((x) => x.name === provinceName);
    const district = province?.districts?.find((x) => x.name === districtName);
    fillOptions(wardSelect, district?.wards ?? []);
  };

  const setLocationValues = (city = "", district = "", ward = "") => {
    if (!provinceSelect || !districtSelect || !wardSelect) return;

    const applyValues = () => {
      fillProvinces();
      if (city) {
        provinceSelect.value = city;
        fillDistricts(city);
      } else {
        resetSelect(districtSelect, placeholders.district);
        resetSelect(wardSelect, placeholders.ward);
        return;
      }

      if (district) {
        districtSelect.value = district;
        fillWards(city, district);
      } else {
        resetSelect(wardSelect, placeholders.ward);
        return;
      }

      if (ward) {
        wardSelect.value = ward;
      }
    };

    if (!locationData.length) {
      pendingLocation = { city, district, ward };
      return;
    }

    applyValues();
  };

  const resetLocationFields = () => {
    pendingLocation = null;
    if (!provinceSelect || !districtSelect || !wardSelect) return;

    if (locationData.length) {
      fillProvinces();
    } else {
      resetSelect(provinceSelect, placeholders.province);
    }
    resetSelect(districtSelect, placeholders.district);
    resetSelect(wardSelect, placeholders.ward);
  };

  provinceSelect?.addEventListener("change", () => {
    fillDistricts(provinceSelect.value);
  });

  districtSelect?.addEventListener("change", () => {
    fillWards(provinceSelect.value, districtSelect.value);
  });

  const loadLocations = async () => {
    if (!provinceSelect || !districtSelect || !wardSelect) return;
    resetLocationFields();

    try {
      const res = await fetch("https://provinces.open-api.vn/api/?depth=3");
      if (!res.ok) throw new Error(res.statusText);
      locationData = await res.json();
      fillProvinces();

      if (pendingLocation) {
        const { city, district, ward } = pendingLocation;
        pendingLocation = null;
        setLocationValues(city, district, ward);
      }
    } catch (error) {
      console.error("Lỗi tải danh sách tỉnh/huyện/xã:", error);
    }
  };

  const baseTitle = modalTitle?.textContent?.trim() || "Thêm Địa Chỉ";
  const baseSubmitLabel = submitBtn?.textContent?.trim() || "Lưu";
  const baseAction = form?.getAttribute("action") || "/user/address";
  const updateAction = form?.dataset.updateAction || baseAction;
  const updateTitle = "Cập nhật Địa Chỉ";
  const updateSubmitLabel = "Cập nhật";

  const openModal = () => {
    overlay?.classList.remove("hidden");
    modal?.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  };

  const closeModal = () => {
    overlay?.classList.add("hidden");
    modal?.classList.add("hidden");
    document.body.style.overflow = "";
  };

  const prepareCreate = () => {
    if (!form) return;
    form.setAttribute("action", baseAction);
    modalTitle && (modalTitle.textContent = baseTitle);
    submitBtn && (submitBtn.textContent = baseSubmitLabel);
    idField && (idField.value = "");
    form.reset();
    if (defaultCheckbox) defaultCheckbox.checked = false;
    resetLocationFields();
  };

  const prepareEdit = (payload) => {
    if (!form) return;
    form.reset();
    form.setAttribute("action", updateAction);
    modalTitle && (modalTitle.textContent = updateTitle);
    submitBtn && (submitBtn.textContent = updateSubmitLabel);
    idField && (idField.value = payload.addressId || "");
    fullNameInput && (fullNameInput.value = payload.fullName || "");
    phoneInput && (phoneInput.value = payload.phone || "");
    line1Input && (line1Input.value = payload.line1 || "");
    if (defaultCheckbox) {
      defaultCheckbox.checked =
        payload.isDefault === "true" || payload.isDefault === true;
    }
    setLocationValues(
      payload.city || "",
      payload.district || "",
      payload.ward || ""
    );
  };

  openBtn?.addEventListener("click", () => {
    prepareCreate();
    openModal();
  });

  editButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const dataset = btn.dataset;
      prepareEdit({
        addressId: dataset.addressId,
        fullName: dataset.fullName,
        phone: dataset.phone,
        line1: dataset.line1,
        city: dataset.city,
        district: dataset.district,
        ward: dataset.ward,
        isDefault: dataset.isDefault,
      });
      openModal();
    });
  });

  closeBtn?.addEventListener("click", closeModal);
  overlay?.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal?.classList.contains("hidden")) {
      closeModal();
    }
  });

  loadLocations();
});

