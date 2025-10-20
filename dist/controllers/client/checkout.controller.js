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
exports.checkoutPost = exports.index = void 0;
const client_1 = require("@prisma/client");
const database_1 = __importDefault(require("../../config/database"));
const FREE_SHIP_THRESHOLD = 500000;
const SHIPPING_FEE = 30000;
const CART_COOKIE_NAME = "cart_id";
const findExistingCart = (identifiers) => __awaiter(void 0, void 0, void 0, function* () {
    const { cartId, tokenUser } = identifiers;
    if (tokenUser) {
        const cart = yield database_1.default.carts.findFirst({
            where: { token_user: tokenUser },
            include: CART_INCLUDE,
        });
        if (cart) {
            return cart;
        }
    }
    if (cartId) {
        const cart = yield database_1.default.carts.findUnique({
            where: { id: cartId },
            include: CART_INCLUDE,
        });
        if (cart && tokenUser && cart.token_user !== tokenUser) {
            yield database_1.default.carts.update({
                where: { id: cart.id },
                data: { token_user: tokenUser },
            });
            cart.token_user = tokenUser;
        }
        return cart ? cart : null;
    }
    return null;
});
const CART_INCLUDE = {
    cart_items: {
        include: {
            products: true,
            productVariants: true,
        },
        orderBy: { id: "asc" },
    },
};
const asNumber = (value) => {
    if (value === null || value === undefined)
        return 0;
    if (typeof value === "number")
        return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    if (value instanceof client_1.Prisma.Decimal) {
        return Number(value.toString());
    }
    return 0;
};
const formatCurrency = (value) => {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
    }).format(Math.max(0, Math.round(value)));
};
const readCookieCartId = (req) => {
    var _a, _b, _c;
    const raw = (_b = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a[CART_COOKIE_NAME]) !== null && _b !== void 0 ? _b : (_c = req.cookies) === null || _c === void 0 ? void 0 : _c.cartId;
    if (!raw)
        return undefined;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};
const readTokenUser = (req) => {
    var _a;
    const raw = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token_user;
    if (typeof raw !== "string")
        return undefined;
    const trimmed = raw.trim();
    return trimmed ? trimmed : undefined;
};
const buildSessionItems = (items) => {
    return items.map((item) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        return ({
            productId: item.product_id,
            slug: (_b = (_a = item.products) === null || _a === void 0 ? void 0 : _a.slug) !== null && _b !== void 0 ? _b : undefined,
            title: (_d = (_c = item.products) === null || _c === void 0 ? void 0 : _c.title) !== null && _d !== void 0 ? _d : "Sản phẩm",
            price: asNumber(item.price_unit),
            size: (_e = item.size) !== null && _e !== void 0 ? _e : undefined,
            color: (_f = item.color) !== null && _f !== void 0 ? _f : undefined,
            quantity: (_g = item.quantity) !== null && _g !== void 0 ? _g : 0,
            image: item.image_url ||
                ((_j = (_h = item.productVariants) === null || _h === void 0 ? void 0 : _h.images) === null || _j === void 0 ? void 0 : _j[0]) ||
                ((_k = item.products) === null || _k === void 0 ? void 0 : _k.thumbnail) ||
                undefined,
            variantId: item.variant_id,
        });
    });
};
const buildCartData = (items) => {
    const sessionItems = buildSessionItems(items);
    let subtotal = 0;
    let discount = 0;
    const viewItems = items.map((item) => {
        var _a, _b, _c, _d, _e, _f;
        const unitPrice = asNumber(item.price_unit);
        const lineSubtotalRaw = item.line_subtotal !== null && item.line_subtotal !== undefined
            ? asNumber(item.line_subtotal)
            : unitPrice * ((_a = item.quantity) !== null && _a !== void 0 ? _a : 0);
        const lineDiscountRaw = item.line_discount !== null && item.line_discount !== undefined
            ? asNumber(item.line_discount)
            : 0;
        const lineTotalRaw = item.line_total !== null && item.line_total !== undefined
            ? asNumber(item.line_total)
            : lineSubtotalRaw - lineDiscountRaw;
        subtotal += lineSubtotalRaw;
        discount += lineDiscountRaw;
        return {
            id: item.id,
            productId: item.product_id,
            variantId: item.variant_id,
            title: (_c = (_b = item.products) === null || _b === void 0 ? void 0 : _b.title) !== null && _c !== void 0 ? _c : "Sản phẩm",
            slug: (_e = (_d = item.products) === null || _d === void 0 ? void 0 : _d.slug) !== null && _e !== void 0 ? _e : "",
            quantity: (_f = item.quantity) !== null && _f !== void 0 ? _f : 0,
            lineTotal: lineTotalRaw,
            lineTotalText: formatCurrency(lineTotalRaw),
        };
    });
    const quantity = items.reduce((sum, item) => { var _a; return sum + ((_a = item.quantity) !== null && _a !== void 0 ? _a : 0); }, 0);
    const totalBeforeShipping = Math.max(0, subtotal - discount);
    const shipping = quantity === 0 || totalBeforeShipping >= FREE_SHIP_THRESHOLD
        ? 0
        : SHIPPING_FEE;
    const total = totalBeforeShipping + shipping;
    const totals = {
        quantity,
        subtotal,
        subtotalText: formatCurrency(subtotal),
        discount,
        discountText: discount > 0
            ? `- ${formatCurrency(discount)}`
            : formatCurrency(0),
        shipping,
        shippingText: formatCurrency(shipping),
        totalBeforeShipping,
        totalBeforeShippingText: formatCurrency(totalBeforeShipping),
        total,
        totalText: formatCurrency(total),
    };
    return { viewItems, totals, sessionItems };
};
const makeEmptyTotals = () => ({
    quantity: 0,
    subtotal: 0,
    subtotalText: formatCurrency(0),
    discount: 0,
    discountText: formatCurrency(0),
    shipping: 0,
    shippingText: formatCurrency(0),
    totalBeforeShipping: 0,
    totalBeforeShippingText: formatCurrency(0),
    total: 0,
    totalText: formatCurrency(0),
});
const applyCouponToSummary = (summary, coupon) => {
    if (!coupon || typeof coupon !== "object") {
        return {
            summary,
            couponInfo: null,
        };
    }
    if (coupon.status !== "ACTIVE") {
        return { summary, couponInfo: null };
    }
    const now = new Date();
    if (coupon.startdate && coupon.startdate > now) {
        return { summary, couponInfo: null };
    }
    if (coupon.enddate && coupon.enddate < now) {
        return { summary, couponInfo: null };
    }
    const updatedSummary = Object.assign(Object.assign({}, summary), { totals: Object.assign({}, summary.totals) });
    const subtotal = updatedSummary.totals.subtotal;
    const existingDiscount = updatedSummary.totals.discount;
    let shipping = updatedSummary.totals.shipping;
    const baseBeforeShipping = Math.max(0, subtotal - existingDiscount);
    const minOrder = asNumber(coupon.minordervalue);
    if (minOrder > 0 && baseBeforeShipping < minOrder) {
        return { summary, couponInfo: null };
    }
    const type = (coupon.type || "").toUpperCase();
    const discountValue = asNumber(coupon.discountvalue);
    let extraDiscount = 0;
    if (type === "PERCENT") {
        extraDiscount = Math.round((baseBeforeShipping * discountValue) / 100);
        const maxDiscount = asNumber(coupon.maxdiscount);
        if (maxDiscount > 0) {
            extraDiscount = Math.min(extraDiscount, maxDiscount);
        }
    }
    else if (type === "FREESHIP") {
        shipping = 0;
        if (discountValue > 0) {
            extraDiscount = discountValue;
        }
    }
    else {
        extraDiscount = discountValue;
    }
    if (extraDiscount < 0)
        extraDiscount = 0;
    const totalDiscount = existingDiscount + extraDiscount;
    const totalBeforeShipping = Math.max(0, subtotal - totalDiscount);
    const total = totalBeforeShipping + shipping;
    updatedSummary.totals = Object.assign(Object.assign({}, updatedSummary.totals), { discount: totalDiscount, discountText: totalDiscount > 0
            ? `- ${formatCurrency(totalDiscount)}`
            : formatCurrency(0), shipping, shippingText: formatCurrency(shipping), totalBeforeShipping, totalBeforeShippingText: formatCurrency(totalBeforeShipping), total, totalText: formatCurrency(total) });
    return {
        summary: updatedSummary,
        couponInfo: {
            id: coupon.couponid,
            code: coupon.code,
            title: coupon.title,
            type,
        },
    };
};
const loadCartSummary = (req) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const identifiers = {
        cartId: readCookieCartId(req),
        tokenUser: readTokenUser(req),
    };
    const sessionCouponRef = resolveAppliedCoupon(req);
    let cart = null;
    if (identifiers.tokenUser) {
        cart = yield database_1.default.carts.findFirst({
            where: { token_user: identifiers.tokenUser },
            include: CART_INCLUDE,
        });
    }
    if (!cart && identifiers.cartId) {
        cart = yield database_1.default.carts.findUnique({
            where: { id: identifiers.cartId },
            include: CART_INCLUDE,
        });
    }
    if (!cart) {
        const sessionItems = (req.session && req.session.cart) || [];
        if (Array.isArray(sessionItems) && sessionItems.length > 0) {
            const subtotal = sessionItems.reduce((sum, item) => { var _a; return sum + item.price * ((_a = item.quantity) !== null && _a !== void 0 ? _a : 0); }, 0);
            const shipping = subtotal === 0 || subtotal >= FREE_SHIP_THRESHOLD
                ? 0
                : SHIPPING_FEE;
            return {
                items: sessionItems.map((item) => {
                    var _a, _b;
                    return ({
                        title: item.title,
                        quantity: item.quantity,
                        lineTotal: item.price * ((_a = item.quantity) !== null && _a !== void 0 ? _a : 0),
                        lineTotalText: formatCurrency(item.price * ((_b = item.quantity) !== null && _b !== void 0 ? _b : 0)),
                    });
                }),
                totals: {
                    quantity: sessionItems.reduce((sum, item) => { var _a; return sum + ((_a = item.quantity) !== null && _a !== void 0 ? _a : 0); }, 0),
                    subtotal,
                    subtotalText: formatCurrency(subtotal),
                    discount: 0,
                    discountText: formatCurrency(0),
                    shipping,
                    shippingText: formatCurrency(shipping),
                    totalBeforeShipping: subtotal,
                    totalBeforeShippingText: formatCurrency(subtotal),
                    total: subtotal + shipping,
                    totalText: formatCurrency(subtotal + shipping),
                },
                coupon: sessionCouponRef,
            };
        }
        return {
            items: [],
            totals: makeEmptyTotals(),
            coupon: sessionCouponRef,
        };
    }
    const items = ((_a = cart.cart_items) !== null && _a !== void 0 ? _a : []);
    let summary = buildCartData(items);
    const cartRecord = cart;
    let appliedCouponInfo = null;
    if (cartRecord.coupon_id) {
        const couponRow = (yield database_1.default.coupons.findUnique({
            where: { couponid: cartRecord.coupon_id },
        }));
        if (couponRow) {
            const result = applyCouponToSummary(summary, couponRow);
            summary = result.summary;
            if (result.couponInfo) {
                appliedCouponInfo = {
                    code: couponRow.code,
                    label: couponRow.title,
                };
            }
        }
    }
    if (typeof cartRecord.shipping_fee !== "undefined" &&
        cartRecord.shipping_fee !== null) {
        const storedShipping = asNumber(cartRecord.shipping_fee);
        if (Number.isFinite(storedShipping)) {
            const totals = summary.totals;
            const totalBeforeShipping = Math.max(0, totals.subtotal - totals.discount);
            const total = totalBeforeShipping + storedShipping;
            summary.totals = Object.assign(Object.assign({}, totals), { shipping: storedShipping, shippingText: formatCurrency(storedShipping), totalBeforeShipping, totalBeforeShippingText: formatCurrency(totalBeforeShipping), total, totalText: formatCurrency(total) });
        }
    }
    if (req.session) {
        req.session.cart = summary.sessionItems;
    }
    const sessionCoupon = req.session && req.session.checkoutCoupon
        ? req.session.checkoutCoupon
        : null;
    return {
        items: summary.viewItems.map((item) => ({
            title: item.title,
            quantity: item.quantity,
            lineTotal: item.lineTotal,
            lineTotalText: item.lineTotalText,
        })),
        totals: summary.totals,
        coupon: appliedCouponInfo || sessionCoupon || sessionCouponRef,
    };
});
const fetchAddresses = (tokenUser) => __awaiter(void 0, void 0, void 0, function* () {
    if (!tokenUser)
        return [];
    const rows = yield database_1.default.addresses.findMany({
        where: { token_user: tokenUser },
        orderBy: [{ is_default: "desc" }, { updated_at: "desc" }],
    });
    return rows.map((addr) => ({
        id: addr.id,
        fullName: addr.full_name,
        phone: addr.phone,
        city: addr.city,
        district: addr.district,
        ward: addr.ward,
        line1: addr.line1,
        isDefault: addr.is_default,
        fullAddress: `${addr.line1}, ${addr.ward}, ${addr.district}, ${addr.city}`,
    }));
});
const resolveAppliedCoupon = (req) => {
    var _a, _b, _c;
    const sessionCoupon = req.session
        ? ((_c = (_b = (_a = req.session.checkoutCoupon) !== null && _a !== void 0 ? _a : req.session.appliedCoupon) !== null && _b !== void 0 ? _b : req.session.cartCoupon) !== null && _c !== void 0 ? _c : null)
        : null;
    if (sessionCoupon && typeof sessionCoupon === "object") {
        const code = typeof sessionCoupon.code === "string"
            ? sessionCoupon.code
            : undefined;
        const label = typeof sessionCoupon.label === "string"
            ? sessionCoupon.label
            : undefined;
        const type = typeof sessionCoupon.type === "string"
            ? sessionCoupon.type
            : undefined;
        if (code) {
            return {
                code,
                label: label !== null && label !== void 0 ? label : undefined,
                type: type !== null && type !== void 0 ? type : undefined,
            };
        }
    }
    if (typeof sessionCoupon === "string" && sessionCoupon.trim() !== "") {
        return { code: sessionCoupon.trim() };
    }
    if (typeof req.query.coupon === "string" && req.query.coupon.trim() !== "") {
        return { code: req.query.coupon.trim() };
    }
    return null;
};
const index = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const [cartSummary, addresses] = yield Promise.all([
            loadCartSummary(req),
            fetchAddresses(readTokenUser(req)),
        ]);
        const appliedCoupon = (_a = cartSummary.coupon) !== null && _a !== void 0 ? _a : resolveAppliedCoupon(req);
        const defaultAddress = addresses && addresses.length
            ? addresses.find((addr) => addr.isDefault) || addresses[0]
            : null;
        res.render("client/pages/checkout/index", {
            checkout: {
                items: cartSummary.items,
                totals: cartSummary.totals,
                coupon: appliedCoupon,
                address: defaultAddress,
            },
            addresses,
        });
    }
    catch (error) {
        console.error("CHECKOUT PAGE ERROR:", error);
        res.status(500).render("client/pages/checkout/index", {
            checkout: {
                items: [],
                totals: makeEmptyTotals(),
                coupon: resolveAppliedCoupon(req),
            },
            addresses: [],
            error: "Không thể tải dữ liệu thanh toán.",
        });
    }
});
exports.index = index;
const checkoutPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const identifiers = {
        cartId: readCookieCartId(req),
        tokenUser: readTokenUser(req),
    };
    const redirectTo = req.get("referer") || "/checkout";
    const { fullName, phone, line1, city, district, ward, note, paymentMethod, } = req.body || {};
    if (typeof fullName !== "string" ||
        fullName.trim() === "" ||
        typeof phone !== "string" ||
        phone.trim() === "" ||
        typeof line1 !== "string" ||
        line1.trim() === "" ||
        typeof city !== "string" ||
        city.trim() === "" ||
        typeof district !== "string" ||
        district.trim() === "" ||
        typeof ward !== "string" ||
        ward.trim() === "" ||
        typeof paymentMethod !== "string" ||
        paymentMethod.trim() === "") {
        req.flash("error", "Vui lòng điền đầy đủ thông tin!");
        return res.redirect(redirectTo);
    }
    const cart = yield findExistingCart(identifiers);
    if (!cart) {
        req.flash("error", "Giỏ hàng trống.");
        return res.redirect(redirectTo);
    }
    const items = ((_a = cart.cart_items) !== null && _a !== void 0 ? _a : []);
    if (!items.length) {
        req.flash("error", "Giỏ hàng trống.");
        return res.redirect(redirectTo);
    }
    let summary = buildCartData(items);
    let couponRow = null;
    if (cart.coupon_id) {
        couponRow = (yield database_1.default.coupons.findUnique({
            where: { couponid: cart.coupon_id },
        }));
    }
    let appliedCouponInfo = null;
    if (couponRow) {
        const result = applyCouponToSummary(summary, couponRow);
        summary = result.summary;
        if (result.couponInfo) {
            appliedCouponInfo = result.couponInfo;
        }
    }
    const orderItemsData = items.map((item) => {
        var _a, _b, _c, _d, _e, _f, _g;
        const unitPrice = asNumber(item.price_unit);
        const quantity = (_a = item.quantity) !== null && _a !== void 0 ? _a : 0;
        const lineTotal = item.line_total !== null && item.line_total !== undefined
            ? asNumber(item.line_total)
            : unitPrice * quantity;
        return {
            product_id: item.product_id,
            variant_id: item.variant_id,
            product_slug: ((_b = item.products) === null || _b === void 0 ? void 0 : _b.slug) || item.product_id,
            thumbnail_snapshot: item.image_url ||
                ((_d = (_c = item.productVariants) === null || _c === void 0 ? void 0 : _c.images) === null || _d === void 0 ? void 0 : _d[0]) ||
                ((_e = item.products) === null || _e === void 0 ? void 0 : _e.thumbnail) ||
                null,
            price: new client_1.Prisma.Decimal(unitPrice),
            quantity,
            size: (_f = item.size) !== null && _f !== void 0 ? _f : null,
            color: (_g = item.color) !== null && _g !== void 0 ? _g : null,
            line_total: new client_1.Prisma.Decimal(lineTotal),
        };
    });
    try {
        const order = yield database_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const createdOrder = yield tx.orders.create({
                data: {
                    token_user: (_a = identifiers.tokenUser) !== null && _a !== void 0 ? _a : null,
                    status: "pending",
                    payment_method: paymentMethod,
                    coupon_id: appliedCouponInfo ? appliedCouponInfo.id : null,
                    subtotal: new client_1.Prisma.Decimal(summary.totals.subtotal),
                    discount_total: new client_1.Prisma.Decimal(summary.totals.discount),
                    shipping_fee: new client_1.Prisma.Decimal(summary.totals.shipping),
                    grand_total: new client_1.Prisma.Decimal(summary.totals.total),
                    shipping_full_name: fullName.trim(),
                    shipping_phone: phone.trim(),
                    shipping_line1: line1.trim(),
                    shipping_city: city.trim(),
                    shipping_district: district.trim(),
                    shipping_ward: ward.trim(),
                    note: typeof note === "string" && note.trim() !== ""
                        ? note.trim()
                        : null,
                    order_items: {
                        create: orderItemsData,
                    },
                },
            });
            yield tx.cart_items.deleteMany({
                where: { cart_id: cart.id },
            });
            yield tx.carts.update({
                where: { id: cart.id },
                data: {
                    grand_total: new client_1.Prisma.Decimal(0),
                    shipping_fee: new client_1.Prisma.Decimal(0),
                    coupon_id: null,
                    updated_at: new Date(),
                },
            });
            return createdOrder;
        }));
        if (req.session) {
            req.session.cart = [];
            req.session.cartCoupon = null;
            req.session.checkoutCoupon = null;
        }
        req.flash("success", `Đặt hàng thành công!`);
        return res.redirect("/");
    }
    catch (error) {
        console.error("CHECKOUT SUBMIT ERROR:", error);
        req.flash("error", "Không thể tạo đơn hàng.");
        return res.redirect(redirectTo);
    }
});
exports.checkoutPost = checkoutPost;
