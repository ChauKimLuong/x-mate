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
exports.clearCart = exports.applyCoupon = exports.prepareCheckout = exports.removeSelectedItems = exports.removeItem = exports.updateItemQuantity = exports.addItem = exports.index = void 0;
const client_1 = require("@prisma/client");
const database_1 = __importDefault(require("../../config/database"));
const CART_COOKIE_NAME = "cart_id";
const CART_COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 30;
const FREE_SHIP_THRESHOLD = 500000;
const SHIPPING_FEE = 30000;
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
const keepCartInSession = (req, items) => {
    if (!req.session)
        return;
    req.session.cart = items;
};
const getRedirectTarget = (req) => {
    var _a;
    const raw = (_a = req.body) === null || _a === void 0 ? void 0 : _a.redirect;
    if (typeof raw !== "string")
        return undefined;
    const trimmed = raw.trim();
    if (!trimmed || !trimmed.startsWith("/"))
        return undefined;
    return trimmed;
};
const redirectWithMessage = (req, res, target, message) => {
    if (message && typeof req.flash === "function") {
        req.flash(message.type, message.text);
    }
    return res.redirect(target);
};
const formatDate = (value) => {
    if (!value)
        return "Không thời hạn";
    return new Intl.DateTimeFormat("vi-VN").format(value);
};
const fetchVouchers = () => __awaiter(void 0, void 0, void 0, function* () {
    const rows = yield database_1.default.coupons.findMany({
        where: { status: "ACTIVE" },
        orderBy: { startdate: "desc" },
        take: 6,
    });
    const now = new Date();
    return rows.map((coupon) => {
        const discountValueNumber = asNumber(coupon.discountvalue);
        const maxDiscountNumber = asNumber(coupon.maxdiscount);
        const minOrderNumber = asNumber(coupon.minordervalue);
        const remaining = typeof coupon.usagelimit === "number"
            ? Math.max(coupon.usagelimit - coupon.usedcount, 0)
            : null;
        const expired = coupon.enddate ? coupon.enddate < now : false;
        const disabled = (remaining !== null && remaining <= 0) || expired;
        const minOrder = coupon.minordervalue !== null && coupon.minordervalue !== undefined
            ? formatCurrency(minOrderNumber)
            : null;
        const benefit = coupon.type === "PERCENT"
            ? `Giảm ${discountValueNumber}%`
            : coupon.type === "FREESHIP"
                ? "Miễn phí vận chuyển"
                : `Giảm ${formatCurrency(discountValueNumber)}`;
        const meta = minOrder
            ? `${benefit} • Đơn từ ${minOrder}`
            : benefit;
        return {
            code: coupon.code,
            title: coupon.title,
            meta,
            expiry: formatDate(coupon.enddate),
            disabled,
            type: coupon.type,
            discountValue: discountValueNumber,
            maxDiscount: maxDiscountNumber > 0 ? maxDiscountNumber : null,
            minOrderValue: minOrderNumber > 0 ? minOrderNumber : null,
        };
    });
});
const buildCartData = (items) => {
    const viewItems = items.map((item) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const quantity = (_a = item.quantity) !== null && _a !== void 0 ? _a : 0;
        const unitPrice = asNumber(item.price_unit);
        const lineSubtotal = item.line_subtotal !== null && item.line_subtotal !== undefined
            ? asNumber(item.line_subtotal)
            : unitPrice * quantity;
        const lineDiscount = item.line_discount !== null && item.line_discount !== undefined
            ? asNumber(item.line_discount)
            : 0;
        const lineTotal = item.line_total !== null && item.line_total !== undefined
            ? asNumber(item.line_total)
            : Math.max(0, lineSubtotal - lineDiscount);
        const image = item.image_url ||
            ((_c = (_b = item.productVariants) === null || _b === void 0 ? void 0 : _b.images) === null || _c === void 0 ? void 0 : _c[0]) ||
            ((_d = item.products) === null || _d === void 0 ? void 0 : _d.thumbnail) ||
            "";
        return {
            id: item.id,
            productId: item.product_id,
            variantId: item.variant_id,
            title: (_f = (_e = item.products) === null || _e === void 0 ? void 0 : _e.title) !== null && _f !== void 0 ? _f : "Sản phẩm",
            slug: (_h = (_g = item.products) === null || _g === void 0 ? void 0 : _g.slug) !== null && _h !== void 0 ? _h : null,
            image,
            color: (_l = (_j = item.color) !== null && _j !== void 0 ? _j : (_k = item.productVariants) === null || _k === void 0 ? void 0 : _k.color) !== null && _l !== void 0 ? _l : null,
            size: (_m = item.size) !== null && _m !== void 0 ? _m : null,
            quantity,
            unitPrice,
            unitPriceText: formatCurrency(unitPrice),
            lineSubtotal,
            lineSubtotalText: formatCurrency(lineSubtotal),
            lineDiscount,
            lineDiscountText: lineDiscount > 0
                ? `- ${formatCurrency(lineDiscount)}`
                : formatCurrency(0),
            lineTotal,
            lineTotalText: formatCurrency(lineTotal),
        };
    });
    const subtotal = viewItems.reduce((sum, item) => sum + item.lineSubtotal, 0);
    const discount = viewItems.reduce((sum, item) => sum + item.lineDiscount, 0);
    const quantity = viewItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalBeforeShipping = Math.max(0, subtotal - discount);
    const shipping = quantity === 0 || totalBeforeShipping >= FREE_SHIP_THRESHOLD
        ? 0
        : SHIPPING_FEE;
    const total = totalBeforeShipping + shipping;
    const freeShipRemaining = Math.max(FREE_SHIP_THRESHOLD - totalBeforeShipping, 0);
    const freeShipProgress = FREE_SHIP_THRESHOLD > 0
        ? Math.min(100, Math.round((totalBeforeShipping / FREE_SHIP_THRESHOLD) * 100))
        : 0;
    const freeShipReached = quantity > 0 && freeShipRemaining === 0;
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
        freeShipRemaining,
        freeShipProgress,
        freeShipReached,
    };
    const freeShip = {
        headerText: `Miễn phí vận chuyển cho đơn từ ${formatCurrency(FREE_SHIP_THRESHOLD)}`,
        thresholdText: formatCurrency(FREE_SHIP_THRESHOLD),
        progressPercent: freeShipProgress,
        remainingText: formatCurrency(freeShipRemaining),
        reached: freeShipReached,
        statusText: quantity === 0
            ? "Bắt đầu thêm sản phẩm vào giỏ để nhận ưu đãi miễn phí vận chuyển."
            : freeShipReached
                ? "Bạn đã đủ điều kiện miễn phí vận chuyển!"
                : `Thêm ${formatCurrency(freeShipRemaining)} để được miễn phí vận chuyển.`,
    };
    const sessionItems = viewItems.map((item) => ({
        productId: item.productId,
        slug: item.slug,
        title: item.title,
        price: item.unitPrice,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        image: item.image,
        variantId: item.variantId,
    }));
    return { viewItems, totals, freeShip, sessionItems };
};
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
const ensureCart = (tx, identifiers) => __awaiter(void 0, void 0, void 0, function* () {
    const { cartId, tokenUser } = identifiers;
    let created = false;
    let cart = tokenUser
        ? yield tx.carts.findFirst({ where: { token_user: tokenUser } })
        : null;
    if (!cart && cartId) {
        cart = yield tx.carts.findUnique({ where: { id: cartId } });
    }
    if (!cart) {
        cart = yield tx.carts.create({
            data: {
                token_user: tokenUser !== null && tokenUser !== void 0 ? tokenUser : null,
            },
        });
        created = true;
    }
    else if (tokenUser && cart.token_user !== tokenUser) {
        cart = yield tx.carts.update({
            where: { id: cart.id },
            data: { token_user: tokenUser },
        });
    }
    return { cart, created };
});
const recalculateCart = (tx, cartId, tokenUser) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const aggregates = yield tx.cart_items.aggregate({
        where: { cart_id: cartId },
        _sum: {
            quantity: true,
            line_total: true,
        },
    });
    const items = (yield tx.cart_items.findMany({
        where: { cart_id: cartId },
        include: CART_INCLUDE.cart_items.include,
        orderBy: { id: "asc" },
    }));
    yield tx.carts.update({
        where: { id: cartId },
        data: Object.assign({ grand_total: new client_1.Prisma.Decimal(asNumber(aggregates._sum.line_total)), updated_at: new Date() }, (tokenUser ? { token_user: tokenUser } : {})),
    });
    return {
        cartId,
        cartQuantity: (_a = aggregates._sum.quantity) !== null && _a !== void 0 ? _a : 0,
        items,
    };
});
const finalizeCartMutation = (req, res, identifiers, result) => {
    const summary = buildCartData(result.items);
    keepCartInSession(req, summary.sessionItems);
    res.locals.cartQuantity = summary.totals.quantity;
    if (!identifiers.cartId || identifiers.cartId !== result.cartId) {
        res.cookie(CART_COOKIE_NAME, result.cartId, {
            httpOnly: true,
            sameSite: "lax",
            maxAge: CART_COOKIE_MAX_AGE,
        });
    }
    identifiers.cartId = result.cartId;
    return summary;
};
const index = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const identifiers = {
        cartId: readCookieCartId(req),
        tokenUser: readTokenUser(req),
    };
    const canUseVoucher = Boolean(identifiers.tokenUser);
    try {
        const cart = yield findExistingCart(identifiers);
        if (cart && identifiers.cartId !== cart.id) {
            res.cookie(CART_COOKIE_NAME, cart.id, {
                httpOnly: true,
                sameSite: "lax",
                maxAge: CART_COOKIE_MAX_AGE,
            });
        }
        else if (!cart && identifiers.cartId) {
            res.clearCookie(CART_COOKIE_NAME);
        }
        let summary = buildCartData(((_a = cart === null || cart === void 0 ? void 0 : cart.cart_items) !== null && _a !== void 0 ? _a : []));
        keepCartInSession(req, summary.sessionItems);
        res.locals.cartQuantity = summary.totals.quantity;
        if (!canUseVoucher && req.session) {
            req.session.cartCoupon = null;
            req.session.checkoutCoupon = null;
        }
        const vouchers = canUseVoucher ? yield fetchVouchers() : [];
        let appliedCoupon = null;
        if (canUseVoucher && (cart === null || cart === void 0 ? void 0 : cart.coupon_id)) {
            const couponRow = yield database_1.default.coupons.findUnique({
                where: { couponid: cart.coupon_id },
            });
            if (couponRow) {
                const result = applyCouponToSummary(summary, couponRow);
                summary = result.summary;
                if (result.couponInfo) {
                    appliedCoupon = {
                        code: result.couponInfo.code,
                        title: result.couponInfo.title,
                        type: result.couponInfo.type,
                    };
                }
            }
        }
        else if (canUseVoucher &&
            req.session &&
            req.session.cartCoupon) {
            const sessionCoupon = req.session.cartCoupon;
            if (sessionCoupon && sessionCoupon.code) {
                const couponRow = yield database_1.default.coupons.findFirst({
                    where: {
                        code: {
                            equals: sessionCoupon.code,
                            mode: "insensitive",
                        },
                    },
                });
                if (couponRow) {
                    const result = applyCouponToSummary(summary, couponRow);
                    summary = result.summary;
                    if (result.couponInfo) {
                        appliedCoupon = {
                            code: result.couponInfo.code,
                            title: result.couponInfo.title,
                            type: result.couponInfo.type,
                        };
                    }
                }
            }
        }
        res.render("client/pages/cart/index", {
            cart: {
                items: summary.viewItems,
                totals: summary.totals,
                isEmpty: summary.viewItems.length === 0,
                coupon: appliedCoupon,
            },
            freeShip: summary.freeShip,
            vouchers,
            canUseVoucher,
        });
    }
    catch (error) {
        console.error("CART INDEX ERROR:", error);
        const emptySummary = buildCartData([]);
        res.status(500).render("client/pages/cart/index", {
            cart: {
                items: [],
                totals: emptySummary.totals,
                isEmpty: true,
                coupon: null,
            },
            freeShip: Object.assign(Object.assign({}, emptySummary.freeShip), { statusText: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau." }),
            vouchers: [],
            canUseVoucher,
        });
    }
});
exports.index = index;
const addItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const redirectTarget = getRedirectTarget(req);
    if (!req.session) {
        if (redirectTarget) {
            return redirectWithMessage(req, res, redirectTarget, {
                type: "error",
                text: "Session không khả dụng.",
            });
        }
        return res.status(400).json({
            success: false,
            message: "Session không khả dụng.",
        });
    }
    const identifiers = {
        cartId: readCookieCartId(req),
        tokenUser: readTokenUser(req),
    };
    const { productId, slug, title, size, color, quantity = 1, image, } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
    if (!productId || typeof productId !== "string") {
        if (redirectTarget) {
            return redirectWithMessage(req, res, redirectTarget, {
                type: "error",
                text: "Thiếu mã sản phẩm.",
            });
        }
        return res.status(400).json({
            success: false,
            message: "Thiếu mã sản phẩm.",
        });
    }
    const normalizedColor = typeof color === "string" && color.trim() !== ""
        ? color.trim()
        : undefined;
    const parsedQuantity = Number.isFinite(Number(quantity))
        ? Math.max(1, Math.floor(Number(quantity)))
        : 1;
    const variant = (yield database_1.default.productVariants.findFirst({
        where: Object.assign({ productId }, (normalizedColor
            ? {
                color: {
                    equals: normalizedColor,
                    mode: "insensitive",
                },
            }
            : {})),
        include: {
            products: true,
        },
    })) ||
        (yield database_1.default.productVariants.findFirst({
            where: { productId },
            include: {
                products: true,
            },
        }));
    if (!variant || !variant.products) {
        if (redirectTarget) {
            return redirectWithMessage(req, res, redirectTarget, {
                type: "error",
                text: "Không tìm thấy phiên bản sản phẩm phù hợp.",
            });
        }
        return res.status(404).json({
            success: false,
            message: "Không tìm thấy phiên bản sản phẩm phù hợp.",
        });
    }
    const allowedSizes = Array.isArray(variant.products.size)
        ? variant.products.size
        : [];
    if (typeof size === "string" &&
        allowedSizes.length > 0 &&
        !allowedSizes.includes(size)) {
        if (redirectTarget) {
            return redirectWithMessage(req, res, redirectTarget, {
                type: "error",
                text: "Kích thước không hợp lệ cho sản phẩm này.",
            });
        }
        return res.status(400).json({
            success: false,
            message: "Kích thước không hợp lệ cho sản phẩm này.",
        });
    }
    const basePrice = asNumber(variant.products.price);
    const discountPercent = asNumber(variant.products.discount);
    const discountedPrice = discountPercent > 0
        ? Math.round((basePrice * (100 - discountPercent)) / 100)
        : basePrice;
    const unitPrice = Math.max(0, discountedPrice);
    const unitPriceDecimal = new client_1.Prisma.Decimal(unitPrice);
    const txResult = yield database_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        const { cart } = yield ensureCart(tx, identifiers);
        const existing = yield tx.cart_items.findUnique({
            where: {
                cart_id_variant_id: {
                    cart_id: cart.id,
                    variant_id: variant.id,
                },
            },
        });
        const nextQuantity = ((_a = existing === null || existing === void 0 ? void 0 : existing.quantity) !== null && _a !== void 0 ? _a : 0) + parsedQuantity;
        const stock = (_b = variant.stock) !== null && _b !== void 0 ? _b : 0;
        if (stock > 0 && nextQuantity > stock) {
            return {
                status: "OUT_OF_STOCK",
                stock,
            };
        }
        const resolvedImage = typeof image === "string" && image.trim() !== ""
            ? image.trim()
            : (existing === null || existing === void 0 ? void 0 : existing.image_url) ||
                ((_c = variant.images) === null || _c === void 0 ? void 0 : _c[0]) ||
                variant.products.thumbnail ||
                null;
        const discountDecimal = new client_1.Prisma.Decimal(asNumber(existing === null || existing === void 0 ? void 0 : existing.line_discount));
        const lineSubtotal = unitPriceDecimal.mul(new client_1.Prisma.Decimal(nextQuantity));
        const lineTotalCandidate = lineSubtotal.sub(discountDecimal);
        const lineTotal = lineTotalCandidate.lessThan(0)
            ? new client_1.Prisma.Decimal(0)
            : lineTotalCandidate;
        if (existing) {
            yield tx.cart_items.update({
                where: {
                    cart_id_variant_id: {
                        cart_id: cart.id,
                        variant_id: variant.id,
                    },
                },
                data: {
                    quantity: nextQuantity,
                    size: typeof size === "string"
                        ? size
                        : existing.size,
                    color: (_e = (_d = normalizedColor !== null && normalizedColor !== void 0 ? normalizedColor : existing.color) !== null && _d !== void 0 ? _d : variant.color) !== null && _e !== void 0 ? _e : null,
                    price_unit: unitPriceDecimal,
                    line_subtotal: lineSubtotal,
                    line_discount: discountDecimal,
                    line_total: lineTotal,
                    image_url: resolvedImage,
                },
            });
        }
        else {
            yield tx.cart_items.create({
                data: {
                    cart_id: cart.id,
                    product_id: productId,
                    variant_id: variant.id,
                    quantity: nextQuantity,
                    size: typeof size === "string" ? size : null,
                    color: (_f = normalizedColor !== null && normalizedColor !== void 0 ? normalizedColor : variant.color) !== null && _f !== void 0 ? _f : null,
                    price_unit: unitPriceDecimal,
                    line_subtotal: lineSubtotal,
                    line_discount: discountDecimal,
                    line_total: lineTotal,
                    image_url: resolvedImage,
                },
            });
        }
        const payload = yield recalculateCart(tx, cart.id, identifiers.tokenUser);
        return {
            status: "OK",
            payload,
        };
    }));
    if (txResult.status === "OUT_OF_STOCK") {
        if (redirectTarget) {
            return redirectWithMessage(req, res, redirectTarget, {
                type: "error",
                text: "Sản phẩm không đủ tồn kho.",
            });
        }
        return res.status(400).json({
            success: false,
            message: "Sản phẩm không đủ tồn kho.",
            details: { stock: txResult.stock },
        });
    }
    const summary = finalizeCartMutation(req, res, identifiers, txResult.payload);
    if (redirectTarget) {
        return redirectWithMessage(req, res, redirectTarget, {
            type: "success",
            text: "Đã thêm vào giỏ hàng.",
        });
    }
    return res.status(200).json({
        success: true,
        message: "Đã thêm vào giỏ hàng.",
        cartQuantity: summary.totals.quantity,
        data: {
            cartId: txResult.payload.cartId,
            productId,
            slug: typeof slug === "string"
                ? slug
                : (_b = variant.products.slug) !== null && _b !== void 0 ? _b : null,
            title: typeof title === "string"
                ? title
                : variant.products.title,
        },
    });
});
exports.addItem = addItem;
const updateItemQuantity = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    if (!req.session) {
        return res.status(400).json({
            success: false,
            message: "Session không khả dụng.",
        });
    }
    const identifiers = {
        cartId: readCookieCartId(req),
        tokenUser: readTokenUser(req),
    };
    const redirectTarget = getRedirectTarget(req);
    const rawItemId = (_d = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.itemId) !== null && _b !== void 0 ? _b : (_c = req.params) === null || _c === void 0 ? void 0 : _c.itemId) !== null && _d !== void 0 ? _d : (_e = req.params) === null || _e === void 0 ? void 0 : _e.id;
    const itemId = Number.parseInt(String(rawItemId !== null && rawItemId !== void 0 ? rawItemId : ""), 10);
    if (!Number.isFinite(itemId)) {
        if (redirectTarget) {
            return redirectWithMessage(req, res, redirectTarget, {
                type: "error",
                text: "Thiếu thông tin sản phẩm trong giỏ.",
            });
        }
        return res.status(400).json({
            success: false,
            message: "Thiếu mã sản phẩm trong giỏ.",
        });
    }
    const cart = yield findExistingCart(identifiers);
    if (!cart) {
        if (redirectTarget) {
            return redirectWithMessage(req, res, redirectTarget, {
                type: "error",
                text: "Không tìm thấy giỏ hàng.",
            });
        }
        return res.status(404).json({
            success: false,
            message: "Không tìm thấy giỏ hàng.",
        });
    }
    const txResult = yield database_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const cartItem = yield tx.cart_items.findFirst({
            where: {
                id: itemId,
                cart_id: cart.id,
            },
            include: {
                productVariants: true,
            },
        });
        if (!cartItem) {
            return {
                status: "NOT_FOUND",
            };
        }
        const currentQuantity = (_a = cartItem.quantity) !== null && _a !== void 0 ? _a : 0;
        const quantityValue = Number((_b = req.body) === null || _b === void 0 ? void 0 : _b.quantity);
        const deltaValue = Number((_d = (_c = req.body) === null || _c === void 0 ? void 0 : _c.delta) !== null && _d !== void 0 ? _d : (_e = req.body) === null || _e === void 0 ? void 0 : _e.change);
        const actionRaw = typeof ((_f = req.body) === null || _f === void 0 ? void 0 : _f.action) === "string"
            ? req.body.action.toLowerCase()
            : undefined;
        let nextQuantity;
        if (actionRaw === "increase") {
            nextQuantity = currentQuantity + 1;
        }
        else if (actionRaw === "decrease") {
            nextQuantity = currentQuantity - 1;
        }
        else if (actionRaw === "set" || actionRaw === "update") {
            if (Number.isFinite(quantityValue)) {
                nextQuantity = Math.floor(quantityValue);
            }
        }
        else if (Number.isFinite(deltaValue)) {
            nextQuantity = currentQuantity + Math.floor(deltaValue);
        }
        else if (Number.isFinite(quantityValue)) {
            nextQuantity = Math.floor(quantityValue);
        }
        if (nextQuantity === undefined || !Number.isFinite(nextQuantity)) {
            return {
                status: "INVALID",
            };
        }
        nextQuantity = Math.floor(nextQuantity);
        if (nextQuantity < 0) {
            nextQuantity = 0;
        }
        const stock = (_h = (_g = cartItem.productVariants) === null || _g === void 0 ? void 0 : _g.stock) !== null && _h !== void 0 ? _h : 0;
        if (stock > 0 && nextQuantity > stock) {
            return {
                status: "OUT_OF_STOCK",
                stock,
            };
        }
        if (nextQuantity === 0) {
            yield tx.cart_items.delete({
                where: { id: cartItem.id },
            });
        }
        else {
            const unitPriceDecimal = new client_1.Prisma.Decimal(asNumber(cartItem.price_unit));
            const discountDecimal = new client_1.Prisma.Decimal(asNumber(cartItem.line_discount));
            const lineSubtotal = unitPriceDecimal.mul(new client_1.Prisma.Decimal(nextQuantity));
            const lineTotalCandidate = lineSubtotal.sub(discountDecimal);
            const lineTotal = lineTotalCandidate.lessThan(0)
                ? new client_1.Prisma.Decimal(0)
                : lineTotalCandidate;
            yield tx.cart_items.update({
                where: { id: cartItem.id },
                data: {
                    quantity: nextQuantity,
                    line_subtotal: lineSubtotal,
                    line_discount: discountDecimal,
                    line_total: lineTotal,
                },
            });
        }
        const payload = yield recalculateCart(tx, cart.id, identifiers.tokenUser);
        return {
            status: "OK",
            payload,
        };
    }));
    if (txResult.status === "INVALID") {
        if (redirectTarget) {
            return redirectWithMessage(req, res, redirectTarget, {
                type: "error",
                text: "Thiếu thông tin số lượng.",
            });
        }
        return res.status(400).json({
            success: false,
            message: "Thiếu thông tin số lượng.",
        });
    }
    if (txResult.status === "NOT_FOUND") {
        if (redirectTarget) {
            return redirectWithMessage(req, res, redirectTarget, {
                type: "error",
                text: "Không tìm thấy sản phẩm trong giỏ hàng.",
            });
        }
        return res.status(404).json({
            success: false,
            message: "Không tìm thấy sản phẩm trong giỏ hàng.",
        });
    }
    if (txResult.status === "OUT_OF_STOCK") {
        if (redirectTarget) {
            return redirectWithMessage(req, res, redirectTarget, {
                type: "error",
                text: "Sản phẩm không đủ tồn kho.",
            });
        }
        return res.status(400).json({
            success: false,
            message: "Sản phẩm không đủ tồn kho.",
            details: { stock: txResult.stock },
        });
    }
    const summary = finalizeCartMutation(req, res, identifiers, txResult.payload);
    const updatedItem = summary.viewItems.find((item) => item.id === itemId);
    if (redirectTarget) {
        const message = updatedItem
            ? "Đã cập nhật giỏ hàng."
            : "Đã xóa sản phẩm khỏi giỏ hàng.";
        return redirectWithMessage(req, res, redirectTarget, {
            type: "success",
            text: message,
        });
    }
    return res.status(200).json({
        success: true,
        message: updatedItem
            ? "Đã cập nhật số lượng."
            : "Đã xóa sản phẩm khỏi giỏ hàng.",
        cartQuantity: summary.totals.quantity,
        cart: {
            items: summary.viewItems,
            totals: summary.totals,
            freeShip: summary.freeShip,
        },
        data: {
            itemId,
            quantity: (_f = updatedItem === null || updatedItem === void 0 ? void 0 : updatedItem.quantity) !== null && _f !== void 0 ? _f : 0,
            removed: !updatedItem,
        },
    });
});
exports.updateItemQuantity = updateItemQuantity;
const removeItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    if (!req.session) {
        const redirectTarget = getRedirectTarget(req);
        if (redirectTarget) {
            return redirectWithMessage(req, res, redirectTarget, {
                type: "error",
                text: "Session không khả dụng.",
            });
        }
        return res.status(400).json({
            success: false,
            message: "Session không khả dụng.",
        });
    }
    const identifiers = {
        cartId: readCookieCartId(req),
        tokenUser: readTokenUser(req),
    };
    const redirectTarget = getRedirectTarget(req);
    const rawItemId = (_d = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.itemId) !== null && _b !== void 0 ? _b : (_c = req.params) === null || _c === void 0 ? void 0 : _c.itemId) !== null && _d !== void 0 ? _d : (_e = req.params) === null || _e === void 0 ? void 0 : _e.id;
    const itemId = Number.parseInt(String(rawItemId !== null && rawItemId !== void 0 ? rawItemId : ""), 10);
    if (!Number.isFinite(itemId)) {
        if (redirectTarget) {
            return redirectWithMessage(req, res, redirectTarget, {
                type: "error",
                text: "Thiếu thông tin sản phẩm trong giỏ.",
            });
        }
        return res.status(400).json({
            success: false,
            message: "Thiếu mã sản phẩm trong giỏ.",
        });
    }
    const cart = yield findExistingCart(identifiers);
    if (!cart) {
        if (redirectTarget) {
            return redirectWithMessage(req, res, redirectTarget, {
                type: "success",
                text: "Giỏ hàng đã trống.",
            });
        }
        return res.status(404).json({
            success: false,
            message: "Không tìm thấy giỏ hàng.",
        });
    }
    const txResult = yield database_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const cartItem = yield tx.cart_items.findFirst({
            where: {
                id: itemId,
                cart_id: cart.id,
            },
        });
        if (!cartItem) {
            return {
                status: "NOT_FOUND",
            };
        }
        yield tx.cart_items.delete({
            where: { id: cartItem.id },
        });
        const payload = yield recalculateCart(tx, cart.id, identifiers.tokenUser);
        return {
            status: "OK",
            payload,
        };
    }));
    if (txResult.status === "NOT_FOUND") {
        if (redirectTarget) {
            return redirectWithMessage(req, res, redirectTarget, {
                type: "error",
                text: "Không tìm thấy sản phẩm trong giỏ hàng.",
            });
        }
        return res.status(404).json({
            success: false,
            message: "Không tìm thấy sản phẩm trong giỏ hàng.",
        });
    }
    const summary = finalizeCartMutation(req, res, identifiers, txResult.payload);
    if (redirectTarget) {
        return redirectWithMessage(req, res, redirectTarget, {
            type: "success",
            text: "Đã xóa sản phẩm khỏi giỏ hàng.",
        });
    }
    return res.status(200).json({
        success: true,
        message: "Đã xóa sản phẩm khỏi giỏ hàng.",
        cartQuantity: summary.totals.quantity,
        cart: {
            items: summary.viewItems,
            totals: summary.totals,
            freeShip: summary.freeShip,
        },
        data: { itemId },
    });
});
exports.removeItem = removeItem;
const removeSelectedItems = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!req.session) {
        const redirectTarget = getRedirectTarget(req);
        if (redirectTarget) {
            return redirectWithMessage(req, res, redirectTarget, {
                type: "error",
                text: "Session không khả dụng.",
            });
        }
        return res.status(400).json({
            success: false,
            message: "Session không khả dụng.",
        });
    }
    const identifiers = {
        cartId: readCookieCartId(req),
        tokenUser: readTokenUser(req),
    };
    const redirectTarget = getRedirectTarget(req);
    const rawIds = (_a = req.body) === null || _a === void 0 ? void 0 : _a.itemIds;
    const idsArray = Array.isArray(rawIds) ? rawIds : rawIds ? [rawIds] : [];
    const parsedIds = idsArray
        .map((value) => Number.parseInt(String(value !== null && value !== void 0 ? value : ""), 10))
        .filter((value) => Number.isFinite(value));
    if (parsedIds.length === 0) {
        if (redirectTarget) {
            return redirectWithMessage(req, res, redirectTarget, {
                type: "error",
                text: "Bạn chưa chọn sản phẩm nào.",
            });
        }
        return res.status(400).json({
            success: false,
            message: "Thiếu danh sách sản phẩm cần xóa.",
        });
    }
    const cart = yield findExistingCart(identifiers);
    if (!cart) {
        if (redirectTarget) {
            return redirectWithMessage(req, res, redirectTarget, {
                type: "success",
                text: "Giỏ hàng đã trống.",
            });
        }
        return res.status(404).json({
            success: false,
            message: "Không tìm thấy giỏ hàng.",
        });
    }
    const txResult = yield database_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const targets = yield tx.cart_items.findMany({
            where: {
                cart_id: cart.id,
                id: { in: parsedIds },
            },
            select: { id: true },
        });
        if (targets.length === 0) {
            return {
                status: "NOT_FOUND",
            };
        }
        yield tx.cart_items.deleteMany({
            where: {
                cart_id: cart.id,
                id: { in: parsedIds },
            },
        });
        const payload = yield recalculateCart(tx, cart.id, identifiers.tokenUser);
        return {
            status: "OK",
            payload,
            removedIds: targets.map((item) => item.id),
        };
    }));
    if (txResult.status === "NOT_FOUND") {
        if (redirectTarget) {
            return redirectWithMessage(req, res, redirectTarget, {
                type: "error",
                text: "Không tìm thấy sản phẩm đã chọn.",
            });
        }
        return res.status(404).json({
            success: false,
            message: "Không tìm thấy sản phẩm đã chọn trong giỏ hàng.",
        });
    }
    const summary = finalizeCartMutation(req, res, identifiers, txResult.payload);
    if (redirectTarget) {
        return redirectWithMessage(req, res, redirectTarget, {
            type: "success",
            text: "Đã xóa các sản phẩm đã chọn.",
        });
    }
    return res.status(200).json({
        success: true,
        message: "Đã xóa sản phẩm đã chọn khỏi giỏ hàng.",
        cartQuantity: summary.totals.quantity,
        cart: {
            items: summary.viewItems,
            totals: summary.totals,
            freeShip: summary.freeShip,
        },
        data: {
            removedIds: txResult.removedIds,
        },
    });
});
exports.removeSelectedItems = removeSelectedItems;
const prepareCheckout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const identifiers = {
            cartId: readCookieCartId(req),
            tokenUser: readTokenUser(req),
        };
        const canUseVoucher = Boolean(identifiers.tokenUser);
        const cart = yield findExistingCart(identifiers);
        if (!cart) {
            return res.status(400).json({
                success: false,
                message: "Giỏ hàng trống.",
            });
        }
        const items = ((_a = cart.cart_items) !== null && _a !== void 0 ? _a : []);
        if (!items.length) {
            return res.status(400).json({
                success: false,
                message: "Giỏ hàng trống.",
            });
        }
        let summary = buildCartData(items);
        const requestedCouponCode = typeof ((_b = req.body) === null || _b === void 0 ? void 0 : _b.couponCode) === "string"
            ? req.body.couponCode.trim()
            : "";
        const couponCode = canUseVoucher ? requestedCouponCode : "";
        let couponRow = null;
        if (canUseVoucher) {
            if (couponCode) {
                couponRow = yield database_1.default.coupons.findFirst({
                    where: {
                        code: {
                            equals: couponCode,
                            mode: "insensitive",
                        },
                    },
                });
            }
            else if (cart.coupon_id) {
                couponRow = (yield database_1.default.coupons.findUnique({
                    where: { couponid: cart.coupon_id },
                }));
            }
        }
        let appliedCouponInfo = null;
        if (couponRow) {
            const result = applyCouponToSummary(summary, couponRow);
            summary = result.summary;
            if (result.couponInfo) {
                appliedCouponInfo = result.couponInfo;
            }
        }
        else if (!canUseVoucher && req.session) {
            req.session.checkoutCoupon = null;
            req.session.cartCoupon = null;
        }
        const shippingFee = Math.max(0, Math.round((_c = summary.totals.shipping) !== null && _c !== void 0 ? _c : 0));
        const grandTotal = Math.max(0, Math.round((_d = summary.totals.total) !== null && _d !== void 0 ? _d : 0));
        yield database_1.default.carts.update({
            where: { id: cart.id },
            data: {
                shipping_fee: new client_1.Prisma.Decimal(shippingFee),
                coupon_id: appliedCouponInfo ? appliedCouponInfo.id : null,
                grand_total: new client_1.Prisma.Decimal(grandTotal),
                updated_at: new Date(),
            },
        });
        if (req.session) {
            const couponSession = appliedCouponInfo
                ? {
                    code: appliedCouponInfo.code,
                    label: appliedCouponInfo.title,
                    type: appliedCouponInfo.type,
                }
                : null;
            req.session.checkoutCoupon = couponSession;
            req.session.cartCoupon = couponSession;
        }
        return res.json({
            success: true,
            redirect: "/checkout",
            totals: summary.totals,
            coupon: appliedCouponInfo
                ? {
                    code: appliedCouponInfo.code,
                    title: appliedCouponInfo.title,
                    type: appliedCouponInfo.type,
                }
                : null,
        });
    }
    catch (error) {
        console.error("PREPARE CHECKOUT ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Không thể chuẩn bị thanh toán.",
        });
    }
});
exports.prepareCheckout = prepareCheckout;
const applyCoupon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const identifiers = {
            cartId: readCookieCartId(req),
            tokenUser: readTokenUser(req),
        };
        const canUseVoucher = Boolean(identifiers.tokenUser);
        if (!canUseVoucher) {
            if (req.session) {
                req.session.cartCoupon = null;
                req.session.checkoutCoupon = null;
            }
            return res.status(403).json({
                success: false,
                message: "Vui lòng đăng nhập để sử dụng mã giảm giá.",
            });
        }
        const cart = yield findExistingCart(identifiers);
        if (!cart) {
            return res.status(400).json({
                success: false,
                message: "Giỏ hàng trống.",
            });
        }
        const items = ((_a = cart.cart_items) !== null && _a !== void 0 ? _a : []);
        if (!items.length) {
            return res.status(400).json({
                success: false,
                message: "Giỏ hàng trống.",
            });
        }
        let summary = buildCartData(items);
        const couponCode = typeof ((_b = req.body) === null || _b === void 0 ? void 0 : _b.couponCode) === "string"
            ? req.body.couponCode.trim()
            : "";
        let couponRow = null;
        if (couponCode) {
            couponRow = yield database_1.default.coupons.findFirst({
                where: {
                    code: {
                        equals: couponCode,
                        mode: "insensitive",
                    },
                    status: "ACTIVE",
                },
            });
        }
        else if (cart.coupon_id) {
            couponRow = (yield database_1.default.coupons.findUnique({
                where: { couponid: Number(cart.coupon_id) },
            }));
        }
        if (couponCode && !couponRow) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy mã giảm giá phù hợp.",
            });
        }
        let appliedCouponInfo = null;
        if (couponRow) {
            const result = applyCouponToSummary(summary, couponRow);
            summary = result.summary;
            if (result.couponInfo) {
                appliedCouponInfo = result.couponInfo;
            }
        }
        else {
            summary = buildCartData(items);
        }
        const shippingFee = Math.max(0, Math.round((_c = summary.totals.shipping) !== null && _c !== void 0 ? _c : 0));
        const grandTotal = Math.max(0, Math.round((_d = summary.totals.total) !== null && _d !== void 0 ? _d : 0));
        yield database_1.default.carts.update({
            where: { id: cart.id },
            data: {
                shipping_fee: new client_1.Prisma.Decimal(shippingFee),
                coupon_id: appliedCouponInfo ? appliedCouponInfo.id : null,
                grand_total: new client_1.Prisma.Decimal(grandTotal),
                updated_at: new Date(),
            },
        });
        if (req.session) {
            req.session.cartCoupon = appliedCouponInfo
                ? {
                    code: appliedCouponInfo.code,
                    label: appliedCouponInfo.title,
                }
                : null;
        }
        return res.json({
            success: true,
            totals: summary.totals,
            coupon: appliedCouponInfo
                ? {
                    code: appliedCouponInfo.code,
                    title: appliedCouponInfo.title,
                }
                : null,
        });
    }
    catch (error) {
        console.error("APPLY COUPON ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Không thể áp dụng mã giảm giá.",
        });
    }
});
exports.applyCoupon = applyCoupon;
const clearCart = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.session) {
        const redirectTarget = getRedirectTarget(req);
        if (redirectTarget) {
            return redirectWithMessage(req, res, redirectTarget, {
                type: "error",
                text: "Session không khả dụng.",
            });
        }
        return res.status(400).json({
            success: false,
            message: "Session không khả dụng.",
        });
    }
    const identifiers = {
        cartId: readCookieCartId(req),
        tokenUser: readTokenUser(req),
    };
    const redirectTarget = getRedirectTarget(req);
    const cart = yield findExistingCart(identifiers);
    if (!cart) {
        const emptySummary = buildCartData([]);
        keepCartInSession(req, emptySummary.sessionItems);
        res.locals.cartQuantity = 0;
        if (identifiers.cartId) {
            res.clearCookie(CART_COOKIE_NAME);
            identifiers.cartId = undefined;
        }
        if (redirectTarget) {
            return redirectWithMessage(req, res, redirectTarget, {
                type: "success",
                text: "Giỏ hàng đã trống.",
            });
        }
        return res.status(200).json({
            success: true,
            message: "Giỏ hàng đã trống.",
            cartQuantity: 0,
            cart: {
                items: emptySummary.viewItems,
                totals: emptySummary.totals,
                freeShip: emptySummary.freeShip,
            },
        });
    }
    const txResult = yield database_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        yield tx.cart_items.deleteMany({
            where: { cart_id: cart.id },
        });
        const payload = yield recalculateCart(tx, cart.id, identifiers.tokenUser);
        return {
            status: "OK",
            payload,
        };
    }));
    const summary = finalizeCartMutation(req, res, identifiers, txResult.payload);
    if (redirectTarget) {
        return redirectWithMessage(req, res, redirectTarget, {
            type: "success",
            text: "Đã xóa toàn bộ giỏ hàng.",
        });
    }
    return res.status(200).json({
        success: true,
        message: "Đã xóa toàn bộ giỏ hàng.",
        cartQuantity: summary.totals.quantity,
        cart: {
            items: summary.viewItems,
            totals: summary.totals,
            freeShip: summary.freeShip,
        },
    });
});
exports.clearCart = clearCart;
