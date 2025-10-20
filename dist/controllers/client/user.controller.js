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
exports.voucher = exports.addressDelete = exports.addressDefault = exports.addressUpdate = exports.addressPost = exports.changePassword = exports.reviewPost = exports.review = exports.updateInfo = exports.order = exports.address = exports.info = void 0;
const database_1 = __importDefault(require("../../config/database"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const info = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const token = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token_user;
        console.log("Token from cookies:", token);
        if (!token) {
            req.flash("error", "Vui lòng đăng nhập để xem thông tin.");
            return res.redirect("/auth/login");
        }
        const user = yield database_1.default.users.findFirst({
            where: {
                status: "active",
                token_user: token,
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
            req.flash("error", "Tài khoản không tồn tại.");
            return res.redirect("/auth/login");
        }
        return res.render("client/pages/user/info", { user });
    }
    catch (error) {
        req.flash("error", "Vui lòng đăng nhập để xem thông tin.");
        res.redirect("/auth/login");
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
        req.flash("error", "Vui lòng đăng nhập để xem thông tin.");
        res.redirect("/auth/login");
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
});
exports.address = address;
const order = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const token = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token_user;
    if (!token) {
        req.flash("error", "Vui lòng đăng nhập để xem đơn hàng.");
        return res.redirect("/auth/login");
    }
    const toNumber = (value) => {
        if (value === null || value === undefined)
            return 0;
        if (typeof value === "number")
            return value;
        if (typeof value === "bigint")
            return Number(value);
        if (typeof value === "string") {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : 0;
        }
        if (value && typeof value === "object" && "toString" in value) {
            const parsed = Number(value.toString());
            return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
    };
    const formatCurrency = (amount) => new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
    }).format(Math.max(0, Math.round(amount)));
    const formatDateTime = (value) => {
        if (!value)
            return "";
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime()))
            return "";
        return new Intl.DateTimeFormat("vi-VN", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(date);
    };
    const statusMap = {
        pending: { label: "Chờ xác nhận", className: "is-pending" },
        paid: { label: "Đã thanh toán", className: "is-paid" },
        shipped: { label: "Đang giao", className: "is-shipped" },
        completed: { label: "Hoàn tất", className: "is-completed" },
        cancelled: { label: "Đã hủy", className: "is-cancelled" },
    };
    const paymentMap = {
        COD: "Thanh toán khi nhận hàng",
        VIETQR: "Chuyển khoản VietQR",
    };
    try {
        const orders = yield database_1.default.orders.findMany({
            where: { token_user: token },
            orderBy: { created_at: "desc" },
            include: {
                order_items: {
                    include: {
                        products: {
                            select: {
                                title: true,
                                slug: true,
                                thumbnail: true,
                            },
                        },
                    },
                    orderBy: { created_at: "asc" },
                },
            },
        });
        const ordersForView = orders.map((order) => {
            var _a, _b, _c;
            const statusInfo = (_a = statusMap[order.status]) !== null && _a !== void 0 ? _a : {
                label: order.status,
                className: "is-pending",
            };
            const paymentLabel = (_b = paymentMap[order.payment_method]) !== null && _b !== void 0 ? _b : order.payment_method;
            const items = (order.order_items || []).map((item) => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                const price = formatCurrency(toNumber(item.price));
                const lineTotal = formatCurrency(toNumber(item.line_total));
                const title = (_b = (_a = item.products) === null || _a === void 0 ? void 0 : _a.title) !== null && _b !== void 0 ? _b : "Sản phẩm";
                const slug = (_d = (_c = item.products) === null || _c === void 0 ? void 0 : _c.slug) !== null && _d !== void 0 ? _d : item.product_slug;
                const thumb = (_g = (_e = item.thumbnail_snapshot) !== null && _e !== void 0 ? _e : (_f = item.products) === null || _f === void 0 ? void 0 : _f.thumbnail) !== null && _g !== void 0 ? _g : "/images/placeholder.png";
                return {
                    id: item.id,
                    title,
                    slug,
                    quantity: (_h = item.quantity) !== null && _h !== void 0 ? _h : 0,
                    size: (_j = item.size) !== null && _j !== void 0 ? _j : null,
                    color: (_k = item.color) !== null && _k !== void 0 ? _k : null,
                    priceText: price,
                    lineTotalText: lineTotal,
                    thumbnail: thumb,
                };
            });
            const totals = {
                subtotalText: formatCurrency(toNumber(order.subtotal)),
                discount: toNumber(order.discount_total),
                discountText: formatCurrency(toNumber(order.discount_total)),
                shippingText: formatCurrency(toNumber(order.shipping_fee)),
                totalText: formatCurrency(toNumber(order.grand_total)),
            };
            const shippingAddress = [
                order.shipping_line1,
                order.shipping_ward,
                order.shipping_district,
                order.shipping_city,
            ]
                .filter(Boolean)
                .join(", ");
            const shippingRecipient = [
                order.shipping_full_name,
                order.shipping_phone,
            ]
                .filter((part) => part && String(part).trim() !== "")
                .join(" • ");
            const quantityTotal = items.reduce((sum, item) => sum + item.quantity, 0);
            return {
                id: order.id,
                shortCode: `#${order.id.slice(0, 8).toUpperCase()}`,
                statusLabel: statusInfo.label,
                statusClass: statusInfo.className,
                createdAtText: formatDateTime(order.created_at),
                paymentLabel,
                totals,
                hasDiscount: totals.discount > 0,
                shipping: {
                    name: order.shipping_full_name,
                    phone: order.shipping_phone,
                    address: shippingAddress,
                    recipient: shippingRecipient,
                },
                note: (_c = order.note) !== null && _c !== void 0 ? _c : null,
                items,
                quantityTotal,
            };
        });
        return res.render("client/pages/user/order", {
            orders: ordersForView,
        });
    }
    catch (error) {
        console.error("USER ORDER LIST ERROR:", error);
        req.flash("error", "Không thể tải danh sách đơn hàng.");
        return res.redirect(req.get("Referer") || "/user/info");
    }
});
exports.order = order;
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
const review = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const token = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token_user;
    if (!token) {
        req.flash("error", "Vui lòng đăng nhập để xem sản phẩm đã mua.");
        return res.redirect("/auth/login");
    }
    const toNumber = (value) => {
        if (value === null || value === undefined)
            return 0;
        if (typeof value === "number")
            return value;
        if (typeof value === "bigint")
            return Number(value);
        if (typeof value === "string") {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : 0;
        }
        if (value && typeof value === "object" && "toString" in value) {
            const parsed = Number(value.toString());
            return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
    };
    const formatCurrency = (amount) => new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
    }).format(Math.max(0, Math.round(amount)));
    const formatDateTime = (value) => {
        if (!value)
            return "";
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime()))
            return "";
        return new Intl.DateTimeFormat("vi-VN", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(date);
    };
    const statusMap = {
        pending: { label: "Chờ xác nhận", className: "is-pending" },
        paid: { label: "Đã thanh toán", className: "is-paid" },
        shipped: { label: "Đang giao", className: "is-shipped" },
        completed: { label: "Hoàn tất", className: "is-completed" },
        cancelled: { label: "Đã hủy", className: "is-cancelled" },
    };
    try {
        const orderItems = yield database_1.default.order_items.findMany({
            where: {
                orders: {
                    token_user: token,
                },
            },
            orderBy: { created_at: "desc" },
            include: {
                orders: {
                    select: {
                        id: true,
                        status: true,
                        created_at: true,
                    },
                },
                products: {
                    select: {
                        title: true,
                        slug: true,
                        thumbnail: true,
                    },
                },
                product_review: {
                    select: {
                        id: true,
                        rating: true,
                        content: true,
                        created_at: true,
                        updated_at: true,
                    },
                },
            },
        });
        const reviewItems = orderItems.map((item) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
            const order = item.orders;
            const statusInfo = (_b = (_a = (order && statusMap[order.status])) !== null && _a !== void 0 ? _a : statusMap.pending) !== null && _b !== void 0 ? _b : { label: (_c = order === null || order === void 0 ? void 0 : order.status) !== null && _c !== void 0 ? _c : "pending", className: "is-pending" };
            const productTitle = (_e = (_d = item.products) === null || _d === void 0 ? void 0 : _d.title) !== null && _e !== void 0 ? _e : "Sản phẩm";
            const productSlug = (_g = (_f = item.products) === null || _f === void 0 ? void 0 : _f.slug) !== null && _g !== void 0 ? _g : item.product_slug;
            const thumb = (_k = (_h = item.thumbnail_snapshot) !== null && _h !== void 0 ? _h : (_j = item.products) === null || _j === void 0 ? void 0 : _j.thumbnail) !== null && _k !== void 0 ? _k : "/images/placeholder.png";
            const quantity = (_l = item.quantity) !== null && _l !== void 0 ? _l : 0;
            const priceText = formatCurrency(toNumber(item.price) || 0);
            const lineTotalText = formatCurrency(toNumber(item.line_total) || 0);
            const orderDate = order ? formatDateTime(order.created_at) : "";
            const reviewAllowedStatuses = new Set([
                "completed",
                "paid",
                "shipped",
            ]);
            const reviewRow = item.product_review;
            const existingReview = reviewRow
                ? {
                    id: reviewRow.id,
                    rating: reviewRow.rating,
                    content: reviewRow.content,
                    createdAt: formatDateTime(reviewRow.created_at),
                    updatedAt: formatDateTime(reviewRow.updated_at),
                    ratingText: `${reviewRow.rating}/5`,
                    ratingStars: Array.from({ length: 5 }, (_, idx) => idx < reviewRow.rating ? "★" : "☆").join(""),
                }
                : null;
            const canReview = !existingReview &&
                !!order &&
                reviewAllowedStatuses.has(order.status || "");
            const orderShort = order
                ? `#${order.id.slice(0, 8).toUpperCase()}`
                : "";
            return {
                id: item.id,
                orderId: (_m = order === null || order === void 0 ? void 0 : order.id) !== null && _m !== void 0 ? _m : "",
                orderShort,
                statusLabel: statusInfo.label,
                statusClass: statusInfo.className,
                orderDate,
                productTitle,
                productSlug,
                thumbnail: thumb,
                quantity,
                size: (_o = item.size) !== null && _o !== void 0 ? _o : null,
                color: (_p = item.color) !== null && _p !== void 0 ? _p : null,
                priceText,
                lineTotalText,
                canReview,
                review: existingReview,
            };
        });
        return res.render("client/pages/user/review", {
            reviews: reviewItems,
        });
    }
    catch (error) {
        console.error("USER REVIEW LIST ERROR:", error);
        req.flash("error", "Không thể tải danh sách sản phẩm đã mua.");
        return res.redirect(req.get("Referer") || "/user/info");
    }
});
exports.review = review;
const reviewPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const token = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token_user;
    if (!token) {
        req.flash("error", "Vui lòng đăng nhập để đánh giá sản phẩm.");
        return res.redirect("/auth/login");
    }
    const orderItemIdRaw = (_b = req.body) === null || _b === void 0 ? void 0 : _b.orderItemId;
    const ratingRaw = (_c = req.body) === null || _c === void 0 ? void 0 : _c.rating;
    const contentRaw = (_d = req.body) === null || _d === void 0 ? void 0 : _d.content;
    const orderItemId = typeof orderItemIdRaw === "string" ? orderItemIdRaw.trim() : "";
    const rating = Number.parseInt(ratingRaw, 10);
    const content = typeof contentRaw === "string" ? contentRaw.trim() : "";
    if (!orderItemId) {
        req.flash("error", "Thiếu thông tin sản phẩm cần đánh giá.");
        return res.redirect(req.get("Referer") || "/user/review");
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        req.flash("error", "Điểm đánh giá không hợp lệ.");
        return res.redirect(req.get("Referer") || "/user/review");
    }
    if (!content || content.length < 10) {
        req.flash("error", "Nội dung đánh giá cần ít nhất 10 ký tự để mô tả trải nghiệm của bạn.");
        return res.redirect(req.get("Referer") || "/user/review");
    }
    try {
        const orderItem = yield database_1.default.order_items.findFirst({
            where: {
                id: orderItemId,
                orders: {
                    token_user: token,
                },
            },
            include: {
                orders: {
                    select: { status: true },
                },
            },
        });
        if (!orderItem) {
            req.flash("error", "Không tìm thấy sản phẩm hợp lệ để đánh giá.");
            return res.redirect(req.get("Referer") || "/user/review");
        }
        const allowedStatuses = new Set(["completed", "paid", "shipped"]);
        const orderStatus = (_f = (_e = orderItem.orders) === null || _e === void 0 ? void 0 : _e.status) !== null && _f !== void 0 ? _f : "";
        if (!allowedStatuses.has(orderStatus)) {
            req.flash("error", "Đơn hàng chưa hoàn tất nên chưa thể đánh giá sản phẩm.");
            return res.redirect(req.get("Referer") || "/user/review");
        }
        yield database_1.default.product_reviews.upsert({
            where: { order_item_id: orderItemId },
            update: {
                rating,
                content,
                updated_at: new Date(),
            },
            create: {
                order_item_id: orderItemId,
                token_user: token,
                rating,
                content,
            },
        });
        req.flash("success", "Cảm ơn bạn đã gửi đánh giá!");
        return res.redirect(req.get("Referer") || "/user/review");
    }
    catch (error) {
        console.error("USER REVIEW SUBMIT ERROR:", error);
        req.flash("error", "Không thể gửi đánh giá. Vui lòng thử lại sau.");
        return res.redirect(req.get("Referer") || "/user/review");
    }
});
exports.reviewPost = reviewPost;
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
            },
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
            where: { status: "ACTIVE", enddate: { gt: new Date() } },
            orderBy: [{ enddate: "asc" }, { createdat: "desc" }],
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
            const discountValue = coupon.discountvalue !== null &&
                coupon.discountvalue !== undefined
                ? Number(coupon.discountvalue)
                : null;
            const maxDiscount = coupon.maxdiscount !== null && coupon.maxdiscount !== undefined
                ? Number(coupon.maxdiscount)
                : null;
            const minOrder = coupon.minordervalue !== null &&
                coupon.minordervalue !== undefined
                ? Number(coupon.minordervalue)
                : null;
            let benefit = "";
            switch (coupon.type) {
                case "PERCENT": {
                    const percent = formatPercent(discountValue);
                    benefit = percent
                        ? `Giảm ${percent}`
                        : "Giảm % trên tổng đơn";
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
        req.flash("error", "Vui lòng đăng nhập để xem thông tin.");
        res.redirect("/auth/login");
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
});
exports.voucher = voucher;
