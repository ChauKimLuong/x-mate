"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.voucher = exports.addressDelete = exports.addressDefault = exports.addressUpdate = exports.addressPost = exports.changePassword = exports.updateInfo = exports.address = exports.info = void 0;
const database_1 = __importDefault(require("../../config/database"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const info = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield database_1.default.users.findFirst({
            where: {
                status: "active",
                token_user: req.cookies.token_user
            },
            select: {
                id: true,
                full_name: true,
                phone: true,
                gender: true,
                dob: true,
                weight_kg: true,
                height_cm: true,
                email: true,
            },
        });
        if (!user) {
            return res
                .status(404)
                .render("client/pages/user/info", { userInfo: null });
        }
        res.render("client/pages/user/info", {
            user: user,
        });
    }
    catch (error) {
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
});
exports.info = info;
const address = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const addressRows = yield database_1.default.addresses.findMany({
            where: { token_user: req.cookies.token_user },
            orderBy: [{ is_default: "desc" }, { updated_at: "desc" }],
        });
        const addresses = addressRows.map((item) => {
            var _a;
            return ({
                id: item.id,
                fullName: item.full_name,
                phone: item.phone,
                city: item.city,
                district: item.district,
                ward: item.ward,
                line1: item.line1,
                line2: (_a = item.line2) !== null && _a !== void 0 ? _a : undefined,
                isDefault: item.is_default,
            });
        });
        res.render("client/pages/user/address", {
            addresses,
        });
    }
    catch (error) {
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
});
exports.address = address;
const updateInfo = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const fullName = req.body.full_name;
        const dob = req.body.dob;
        const gender = req.body.gender;
        const phone = req.body.phone;
        const height_cm = req.body.height_cm;
        const weight_kg = req.body.weight_kg;
        if (!fullName ||
            !dob ||
            !gender ||
            !phone ||
            !height_cm ||
            !weight_kg) {
            req.flash("error", "Vui lòng điền đầy đủ thông tin!");
            res.redirect(req.get("Referer") || "/");
        }
        yield database_1.default.users.update({
            where: { token_user: req.cookies.token_user },
            data: {
                full_name: fullName,
                dob: new Date(dob),
                gender,
                phone,
                height_cm: Number(height_cm),
                weight_kg: Number(weight_kg),
            },
        });
        req.flash("success", "Cập nhật thông tin thành công!");
        res.redirect(req.get("Referer") || "/user/info");
    }
    catch (error) {
        req.flash("error", "Có lỗi xảy ra khi cập nhật.");
        res.redirect(req.get("Referer") || "/user/info");
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
});
exports.updateInfo = updateInfo;
const changePassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const oldPassword = req.body.old_password;
        const newPassword = req.body.new_password;
        const confirmPassword = req.body.confirm_password;
        console.log(oldPassword, newPassword, confirmPassword);
        if (!oldPassword || !newPassword || !confirmPassword) {
            req.flash("error", "Vui lòng điền đầy đủ thông tin!");
            return res.redirect(req.get("Referer") || "/user/info");
        }
        const user = yield database_1.default.users.findUnique({
            where: { token_user: req.cookies.token_user },
        });
        if (!user) {
            req.flash("error", "Không tìm thấy tài khoản!");
            return res.redirect(req.get("Referer") || "/user/info");
        }
        const match = yield bcrypt_1.default.compare(oldPassword, user.password);
        if (!match) {
            req.flash("error", "Mật khẩu cũ không đúng!");
            return res.redirect(req.get("Referer") || "/user/info");
        }
        if (newPassword !== confirmPassword) {
            req.flash("error", "Xác nhận mật khẩu không khớp!");
            return res.redirect(req.get("Referer") || "/user/info");
        }
        const hashedNewPassword = yield bcrypt_1.default.hash(newPassword, 10);
        yield database_1.default.users.update({
            where: { token_user: req.cookies.token_user },
            data: { password: hashedNewPassword },
        });
        req.flash("success", "Đổi mật thành công!");
        return res.redirect(req.get("Referer") || "/user/info");
    }
    catch (error) {
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
        req.flash("error", "Có lỗi xảy ra!");
        return res.redirect(req.get("Referer") || "/user/info");
    }
});
exports.changePassword = changePassword;
const addressPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { full_name, phone, city, district, ward, line1 } = req.body;
        if (!full_name || !phone || !city || !district || !ward || !line1) {
            req.flash("error", "Vui lòng điền đầy đủ thông tin!");
            return res.redirect(req.get("Referer") || "/user/address");
        }
        const isDefault = req.body.isDefault === "on" ||
            req.body.isDefault === "true" ||
            req.body.isDefault === true;
        const tokenUser = req.cookies.token_user;
        if (isDefault) {
            yield database_1.default.addresses.updateMany({
                where: { token_user: tokenUser },
                data: { is_default: false },
            });
        }
        yield database_1.default.addresses.create({
            data: {
                token_user: tokenUser,
                full_name,
                phone,
                city,
                district,
                ward,
                line1,
                is_default: isDefault,
            },
        });
        req.flash("success", "Thêm địa chỉ thành công!");
        return res.redirect(req.get("Referer") || "/user/address");
    }
    catch (error) {
        console.error("ERROR:", error);
        req.flash("error", "Có lỗi xảy ra!");
        return res.redirect(req.get("Referer") || "/user/address");
    }
});
exports.addressPost = addressPost;
const addressUpdate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, full_name, phone, city, district, ward, line1 } = req.body;
        const addressId = Number(id);
        if (!addressId || Number.isNaN(addressId)) {
            req.flash("error", "Không tìm thấy địa chỉ cần cập nhật!");
            return res.redirect(req.get("Referer") || "/user/address");
        }
        const fullName = typeof full_name === "string" ? full_name.trim() : "";
        const phoneNumber = typeof phone === "string" ? phone.trim() : "";
        const cityName = typeof city === "string" ? city.trim() : "";
        const districtName = typeof district === "string" ? district.trim() : "";
        const wardName = typeof ward === "string" ? ward.trim() : "";
        const addressLine = typeof line1 === "string" ? line1.trim() : "";
        if (!fullName ||
            !phoneNumber ||
            !cityName ||
            !districtName ||
            !wardName ||
            !addressLine) {
            req.flash("error", "Vui lòng điền đầy đủ thông tin!");
            return res.redirect(req.get("Referer") || "/user/address");
        }
        const isDefault = req.body.isDefault === "on" ||
            req.body.isDefault === "true" ||
            req.body.isDefault === true;
        const tokenUser = req.cookies.token_user;
        const existingAddress = yield database_1.default.addresses.findFirst({
            where: { id: addressId, token_user: tokenUser },
        });
        if (!existingAddress) {
            req.flash("error", "Không tìm thấy địa chỉ cần cập nhật!");
            return res.redirect(req.get("Referer") || "/user/address");
        }
        if (isDefault) {
            yield database_1.default.addresses.updateMany({
                where: { token_user: tokenUser },
                data: { is_default: false },
            });
        }
        yield database_1.default.addresses.update({
            where: { id: addressId },
            data: {
                full_name: fullName,
                phone: phoneNumber,
                city: cityName,
                district: districtName,
                ward: wardName,
                line1: addressLine,
                is_default: isDefault,
                updated_at: new Date(),
            },
        });
        req.flash("success", "Cập nhật địa chỉ thành công!");
        return res.redirect(req.get("Referer") || "/user/address");
    }
    catch (error) {
        console.error("ERROR:", error);
        req.flash("error", "Có lỗi xảy ra!");
        return res.redirect(req.get("Referer") || "/user/address");
    }
});
exports.addressUpdate = addressUpdate;
const addressDefault = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const addressId = Number(req.params.addressId);
        yield database_1.default.addresses.updateMany({
            where: {
                NOT: { id: addressId },
            },
            data: {
                is_default: false,
            },
        });
        yield database_1.default.addresses.update({
            where: { id: addressId },
            data: { is_default: true },
        });
        req.flash("success", "Cập nhật địa chỉ thành công!");
        return res.redirect(req.get("Referer") || "/user/address");
    }
    catch (error) {
        console.error("ERROR:", error);
        req.flash("error", "Có lỗi xảy ra!");
        return res.redirect(req.get("Referer") || "/user/address");
    }
});
exports.addressDefault = addressDefault;
const addressDelete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const addressId = Number(req.params.addressId);
        yield database_1.default.addresses.delete({
            where: {
                id: addressId,
            }
        });
        req.flash("success", "Xóa địa chỉ thành công!");
        return res.redirect(req.get("Referer") || "/user/address");
    }
    catch (error) {
        console.error("ERROR:", error);
        req.flash("error", "Có lỗi xảy ra!");
        return res.redirect(req.get("Referer") || "/user/address");
    }
});
exports.addressDelete = addressDelete;
const voucher = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const coupons = yield database_1.default.coupons.findMany({
            where: { status: "ACTIVE",
                enddate: { gt: new Date }
            },
            orderBy: [
                { enddate: "asc" },
                { createdat: "desc" },
            ],
            select: {
                couponid: true,
                code: true,
                title: true,
                type: true,
                enddate: true,
                usagelimit: true,
                usedcount: true,
                minordervalue: true,
                discountvalue: true,
                maxdiscount: true,
                startdate: true,
            },
        });
        const formatCurrency = (value) => {
            if (value === undefined || value === null)
                return null;
            const numberValue = typeof value === "number" ? value : Number(value);
            if (!Number.isFinite(numberValue))
                return null;
            return new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
                maximumFractionDigits: 0,
            }).format(numberValue);
        };
        const formatPercent = (value) => {
            if (value === undefined || value === null)
                return null;
            const numberValue = typeof value === "number" ? value : Number(value);
            if (!Number.isFinite(numberValue))
                return null;
            return `${numberValue % 1 === 0 ? numberValue : numberValue.toFixed(1)}%`;
        };
        const formatDate = (date) => {
            if (!date)
                return "Không giới hạn";
            return new Intl.DateTimeFormat("vi-VN").format(date);
        };
        const now = new Date();
        const vouchers = coupons.map((coupon) => {
            var _a, _b, _c;
            const remaining = typeof coupon.usagelimit === "number"
                ? Math.max(coupon.usagelimit - coupon.usedcount, 0)
                : null;
            const isOutOfQuota = typeof remaining === "number" ? remaining <= 0 : false;
            const rawTitle = ((_a = coupon.title) === null || _a === void 0 ? void 0 : _a.trim()) || "";
            const discountValue = coupon.discountvalue !== null && coupon.discountvalue !== undefined
                ? Number(coupon.discountvalue)
                : null;
            const maxDiscount = coupon.maxdiscount !== null && coupon.maxdiscount !== undefined
                ? Number(coupon.maxdiscount)
                : null;
            const minOrder = coupon.minordervalue !== null && coupon.minordervalue !== undefined
                ? Number(coupon.minordervalue)
                : null;
            let benefit = "";
            switch (coupon.type) {
                case "PERCENT": {
                    const percent = formatPercent(discountValue);
                    benefit = percent ? `Giảm ${percent}` : "Giảm % trên tổng đơn";
                    if (maxDiscount) {
                        benefit += ` (tối đa ${formatCurrency(maxDiscount)})`;
                    }
                    break;
                }
                case "AMOUNT": {
                    const amount = formatCurrency(discountValue);
                    benefit = amount ? `Giảm ${amount}` : "Giảm giá trực tiếp";
                    break;
                }
                case "FREESHIP": {
                    benefit = "Miễn phí vận chuyển";
                    if (maxDiscount) {
                        benefit += ` (tối đa ${formatCurrency(maxDiscount)})`;
                    }
                    break;
                }
                default:
                    benefit = "Ưu đãi đặc biệt";
            }
            const notes = [];
            if (benefit)
                notes.push(benefit);
            if (minOrder) {
                notes.push(`Đơn tối thiểu ${formatCurrency(minOrder)}`);
            }
            if (coupon.startdate) {
                notes.push(`Hiệu lực từ ${formatDate(coupon.startdate)}`);
            }
            const normalizedTitle = rawTitle.toLowerCase();
            const normalizedCode = (_c = (_b = coupon.code) === null || _b === void 0 ? void 0 : _b.trim().toLowerCase()) !== null && _c !== void 0 ? _c : "";
            const notesForView = [...notes];
            let description = rawTitle;
            if (!description ||
                (normalizedTitle && normalizedTitle === normalizedCode)) {
                description =
                    notesForView.length > 0
                        ? notesForView.shift() || "Ưu đãi hấp dẫn đang chờ bạn"
                        : "Ưu đãi hấp dẫn đang chờ bạn";
            }
            return {
                id: coupon.couponid,
                code: coupon.code,
                description,
                notes: notesForView,
                remaining,
                remainingLabel: typeof remaining === "number"
                    ? remaining > 0
                        ? `Còn ${remaining}`
                        : "Hết lượt"
                    : "Không giới hạn",
                expiryText: formatDate(coupon.enddate),
                isExpired: coupon.enddate ? coupon.enddate < now : false,
                isOutOfQuota,
                termsUrl: "#",
            };
        });
        res.render("client/pages/user/voucher", {
            vouchers,
        });
    }
    catch (error) {
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
});
exports.voucher = voucher;
