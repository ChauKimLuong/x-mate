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
exports.addItem = exports.index = void 0;
const client_1 = require("@prisma/client");
const database_1 = __importDefault(require("../../config/database"));
const CART_COOKIE_NAME = "cart_id";
const CART_COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 30;
const FREE_SHIP_THRESHOLD = 500000;
const SHIPPING_FEE = 30000;
class CartOperationError extends Error {
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = "CartOperationError";
    }
}
const CART_INCLUDE = {
    cart_items: {
        include: {
            products: {
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    price: true,
                    discount: true,
                    thumbnail: true,
                    size: true,
                },
            },
            productVariants: {
                select: {
                    id: true,
                    color: true,
                    images: true,
                    stock: true,
                },
            },
        },
        orderBy: { id: "asc" },
    },
};
const decimalToNumber = (value) => {
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
const toCurrency = (value) => {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
    }).format(Math.max(0, Math.round(value)));
};
const makeEmptyTotals = () => ({
    quantity: 0,
    subtotal: 0,
    subtotalText: toCurrency(0),
    discount: 0,
    discountText: toCurrency(0),
    shipping: 0,
    shippingText: toCurrency(0),
    totalBeforeShipping: 0,
    totalBeforeShippingText: toCurrency(0),
    total: 0,
    totalText: toCurrency(0),
    freeShipRemaining: FREE_SHIP_THRESHOLD,
    freeShipProgress: 0,
    freeShipReached: false,
});
const makeEmptyFreeShip = () => ({
    headerText: `Miễn phí vận chuyển cho đơn từ ${toCurrency(FREE_SHIP_THRESHOLD)}`,
    thresholdText: toCurrency(FREE_SHIP_THRESHOLD),
    progressPercent: 0,
    remainingText: toCurrency(FREE_SHIP_THRESHOLD),
    reached: false,
    statusText: "Bắt đầu thêm sản phẩm vào giỏ để nhận ưu đãi miễn phí vận chuyển.",
});
const normalizeColor = (input) => {
    if (typeof input !== "string")
        return null;
    const trimmed = input.trim();
    return trimmed ? trimmed : null;
};
const getCartCookieId = (req) => {
    var _a, _b, _c;
    const raw = (_b = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a[CART_COOKIE_NAME]) !== null && _b !== void 0 ? _b : (_c = req.cookies) === null || _c === void 0 ? void 0 : _c.cartId;
    if (!raw)
        return undefined;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};
const getTokenUser = (req) => {
    var _a;
    const token = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token_user;
    return typeof token === "string" && token.trim() !== "" ? token : undefined;
};
const syncSessionCart = (req, items) => {
    if (!req.session)
        return;
    req.session.cart = items;
};
const buildSessionItems = (items) => {
    return items.map((item) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        return ({
            productId: item.product_id,
            slug: (_b = (_a = item.products) === null || _a === void 0 ? void 0 : _a.slug) !== null && _b !== void 0 ? _b : undefined,
            title: (_d = (_c = item.products) === null || _c === void 0 ? void 0 : _c.title) !== null && _d !== void 0 ? _d : "Sản phẩm",
            price: decimalToNumber(item.price_unit),
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
const buildCartView = (items) => {
    const sessionItems = buildSessionItems(items);
    let subtotal = 0;
    let discount = 0;
    const viewItems = items.map((item) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const unitPrice = decimalToNumber(item.price_unit);
        const lineSubtotalRaw = item.line_subtotal !== null && item.line_subtotal !== undefined
            ? decimalToNumber(item.line_subtotal)
            : unitPrice * ((_a = item.quantity) !== null && _a !== void 0 ? _a : 0);
        const lineDiscountRaw = item.line_discount !== null && item.line_discount !== undefined
            ? decimalToNumber(item.line_discount)
            : 0;
        const lineTotalRaw = item.line_total !== null && item.line_total !== undefined
            ? decimalToNumber(item.line_total)
            : lineSubtotalRaw - lineDiscountRaw;
        subtotal += lineSubtotalRaw;
        discount += lineDiscountRaw;
        return {
            id: item.id,
            productId: item.product_id,
            variantId: item.variant_id,
            title: (_c = (_b = item.products) === null || _b === void 0 ? void 0 : _b.title) !== null && _c !== void 0 ? _c : "Sản phẩm",
            slug: (_e = (_d = item.products) === null || _d === void 0 ? void 0 : _d.slug) !== null && _e !== void 0 ? _e : "",
            image: item.image_url ||
                ((_g = (_f = item.productVariants) === null || _f === void 0 ? void 0 : _f.images) === null || _g === void 0 ? void 0 : _g[0]) ||
                ((_h = item.products) === null || _h === void 0 ? void 0 : _h.thumbnail) ||
                "",
            color: (_l = (_j = item.color) !== null && _j !== void 0 ? _j : (_k = item.productVariants) === null || _k === void 0 ? void 0 : _k.color) !== null && _l !== void 0 ? _l : null,
            size: (_m = item.size) !== null && _m !== void 0 ? _m : null,
            quantity: (_o = item.quantity) !== null && _o !== void 0 ? _o : 0,
            unitPrice,
            unitPriceText: toCurrency(unitPrice),
            lineSubtotal: lineSubtotalRaw,
            lineSubtotalText: toCurrency(lineSubtotalRaw),
            lineDiscount: lineDiscountRaw,
            lineDiscountText: lineDiscountRaw > 0 ? `- ${toCurrency(lineDiscountRaw)}` : toCurrency(0),
            lineTotal: lineTotalRaw,
            lineTotalText: toCurrency(lineTotalRaw),
        };
    });
    const quantity = items.reduce((sum, item) => { var _a; return sum + ((_a = item.quantity) !== null && _a !== void 0 ? _a : 0); }, 0);
    const totalBeforeShipping = Math.max(0, subtotal - discount);
    const shipping = quantity === 0
        ? 0
        : totalBeforeShipping >= FREE_SHIP_THRESHOLD
            ? 0
            : SHIPPING_FEE;
    const total = totalBeforeShipping + shipping;
    const freeShipRemaining = Math.max(FREE_SHIP_THRESHOLD - totalBeforeShipping, 0);
    const freeShipProgress = FREE_SHIP_THRESHOLD > 0
        ? Math.min(100, Math.round((totalBeforeShipping / FREE_SHIP_THRESHOLD) * 100))
        : 0;
    const freeShipReached = freeShipRemaining <= 0 && quantity > 0;
    const totals = {
        quantity,
        subtotal,
        subtotalText: toCurrency(subtotal),
        discount,
        discountText: discount > 0 ? `- ${toCurrency(discount)}` : toCurrency(0),
        shipping,
        shippingText: toCurrency(shipping),
        totalBeforeShipping,
        totalBeforeShippingText: toCurrency(totalBeforeShipping),
        total,
        totalText: toCurrency(total),
        freeShipRemaining,
        freeShipProgress,
        freeShipReached,
    };
    const freeShip = {
        headerText: `Miễn phí vận chuyển cho đơn từ ${toCurrency(FREE_SHIP_THRESHOLD)}`,
        thresholdText: toCurrency(FREE_SHIP_THRESHOLD),
        progressPercent: freeShipProgress,
        remainingText: toCurrency(freeShipRemaining),
        reached: freeShipReached,
        statusText: quantity === 0
            ? "Bắt đầu thêm sản phẩm vào giỏ để nhận ưu đãi miễn phí vận chuyển."
            : freeShipReached
                ? "Bạn đã đủ điều kiện miễn phí vận chuyển!"
                : `Thêm ${toCurrency(freeShipRemaining)} để được miễn phí vận chuyển.`,
    };
    return { viewItems, totals, sessionItems, freeShip };
};
const formatDate = (value) => {
    if (!value)
        return "Không thời hạn";
    return new Intl.DateTimeFormat("vi-VN").format(value);
};
const mapVoucherView = (rows) => {
    const now = new Date();
    return rows.map((coupon) => {
        const remaining = typeof coupon.usagelimit === "number"
            ? Math.max(coupon.usagelimit - coupon.usedcount, 0)
            : null;
        const isExpired = coupon.enddate ? coupon.enddate < now : false;
        const disabled = (remaining !== null && remaining <= 0) || isExpired;
        const discountValue = toCurrency(decimalToNumber(coupon.discountvalue));
        const minOrder = coupon.minordervalue !== null && coupon.minordervalue !== undefined
            ? toCurrency(decimalToNumber(coupon.minordervalue))
            : null;
        const benefit = coupon.type === "PERCENT"
            ? `Giảm ${decimalToNumber(coupon.discountvalue)}%`
            : coupon.type === "FREESHIP"
                ? "Miễn phí vận chuyển"
                : `Giảm ${discountValue}`;
        const metaParts = [benefit];
        if (minOrder) {
            metaParts.push(`Đơn từ ${minOrder}`);
        }
        return {
            code: coupon.code,
            title: coupon.title,
            meta: metaParts.join(" • "),
            expiry: formatDate(coupon.enddate),
            disabled,
        };
    });
};
const ensureCartRecord = (tx, identifiers) => __awaiter(void 0, void 0, void 0, function* () {
    const { cartId, tokenUser } = identifiers;
    let created = false;
    let reassigned = false;
    let cart = null;
    if (tokenUser) {
        cart = yield tx.carts.findFirst({
            where: { token_user: tokenUser },
        });
    }
    if (!cart && cartId) {
        cart = yield tx.carts.findUnique({ where: { id: cartId } });
        if (cart && tokenUser && cart.token_user !== tokenUser) {
            cart = yield tx.carts.update({
                where: { id: cart.id },
                data: { token_user: tokenUser },
            });
            reassigned = true;
        }
    }
    if (!cart) {
        cart = yield tx.carts.create({
            data: {
                token_user: tokenUser !== null && tokenUser !== void 0 ? tokenUser : null,
            },
        });
        created = true;
    }
    return { cart, created, reassigned };
});
const index = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const tokenUser = getTokenUser(req);
        const cookieCartId = getCartCookieId(req);
        let cart = null;
        if (tokenUser) {
            cart = yield database_1.default.carts.findFirst({
                where: { token_user: tokenUser },
                include: CART_INCLUDE,
            });
        }
        if (!cart && cookieCartId) {
            cart = yield database_1.default.carts.findUnique({
                where: { id: cookieCartId },
                include: CART_INCLUDE,
            });
            if (cart && tokenUser && cart.token_user !== tokenUser) {
                yield database_1.default.carts.update({
                    where: { id: cart.id },
                    data: { token_user: tokenUser },
                });
                cart.token_user = tokenUser;
            }
        }
        if (cart) {
            if (!cookieCartId || cookieCartId !== cart.id) {
                res.cookie(CART_COOKIE_NAME, cart.id, {
                    httpOnly: true,
                    sameSite: "lax",
                    maxAge: CART_COOKIE_MAX_AGE,
                });
            }
        }
        else if (cookieCartId) {
            res.clearCookie(CART_COOKIE_NAME);
        }
        const items = ((_a = cart === null || cart === void 0 ? void 0 : cart.cart_items) !== null && _a !== void 0 ? _a : []);
        const { viewItems, totals, sessionItems, freeShip } = buildCartView(items);
        syncSessionCart(req, sessionItems);
        res.locals.cartQuantity = totals.quantity;
        const voucherRows = yield database_1.default.coupons.findMany({
            where: { status: "ACTIVE" },
            orderBy: { startdate: "desc" },
            take: 6,
        });
        const vouchers = mapVoucherView(voucherRows);
        res.render("client/pages/cart/index", {
            cart: {
                items: viewItems,
                totals,
                isEmpty: viewItems.length === 0,
            },
            freeShip,
            vouchers,
        });
    }
    catch (error) {
        console.error("CART INDEX ERROR:", error);
        res.status(500).render("client/pages/cart/index", {
            cart: { items: [], totals: makeEmptyTotals(), isEmpty: true },
            freeShip: Object.assign(Object.assign({}, makeEmptyFreeShip()), { statusText: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau." }),
            vouchers: [],
        });
    }
});
exports.index = index;
const addItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        if (!req.session) {
            return res.status(400).json({
                success: false,
                message: "Session không khả dụng.",
            });
        }
        const { productId, slug, title, size, color, quantity = 1, image, } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
        if (!productId || typeof productId !== "string") {
            return res.status(400).json({
                success: false,
                message: "Thiếu mã sản phẩm.",
            });
        }
        const normalizedColor = normalizeColor(color);
        const parsedQuantity = Number.isFinite(Number(quantity))
            ? Math.max(1, Math.floor(Number(quantity)))
            : 1;
        const variantWithProduct = (yield database_1.default.productVariants.findFirst({
            where: Object.assign({ productId }, (normalizedColor
                ? {
                    color: {
                        equals: normalizedColor,
                        mode: "insensitive",
                    },
                }
                : {})),
            include: {
                products: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        price: true,
                        discount: true,
                        thumbnail: true,
                        size: true,
                    },
                },
            },
        })) ||
            (yield database_1.default.productVariants.findFirst({
                where: { productId },
                include: {
                    products: {
                        select: {
                            id: true,
                            title: true,
                            slug: true,
                            price: true,
                            discount: true,
                            thumbnail: true,
                            size: true,
                        },
                    },
                },
            }));
        if (!variantWithProduct || !variantWithProduct.products) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy phiên bản sản phẩm phù hợp.",
            });
        }
        const allowedSizes = Array.isArray(variantWithProduct.products.size)
            ? variantWithProduct.products.size
            : [];
        if (typeof size === "string" &&
            allowedSizes.length > 0 &&
            !allowedSizes.includes(size)) {
            throw new CartOperationError("INVALID_SIZE", "Kích thước không hợp lệ cho sản phẩm này.");
        }
        const basePrice = Number(variantWithProduct.products.price) || 0;
        const discountPercent = Number(variantWithProduct.products.discount) || 0;
        const discountedPrice = Math.round((basePrice * (100 - discountPercent)) / 100);
        const unitPriceNumber = discountedPrice > 0 ? discountedPrice : Math.max(0, basePrice);
        const unitPriceDecimal = new client_1.Prisma.Decimal(unitPriceNumber);
        const identifiers = {
            cartId: getCartCookieId(req),
            tokenUser: getTokenUser(req),
        };
        const result = yield database_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const { cart, created } = yield ensureCartRecord(tx, identifiers);
            const existing = yield tx.cart_items.findUnique({
                where: {
                    cart_id_variant_id: {
                        cart_id: cart.id,
                        variant_id: variantWithProduct.id,
                    },
                },
            });
            const newQuantity = ((_a = existing === null || existing === void 0 ? void 0 : existing.quantity) !== null && _a !== void 0 ? _a : 0) + parsedQuantity;
            const variantStock = (_b = variantWithProduct.stock) !== null && _b !== void 0 ? _b : 0;
            if (variantStock > 0 && newQuantity > variantStock) {
                throw new CartOperationError("OUT_OF_STOCK", "Số lượng vượt quá tồn kho.", {
                    stock: variantStock,
                });
            }
            const lineSubtotal = unitPriceDecimal.mul(new client_1.Prisma.Decimal(newQuantity));
            const discountDecimal = new client_1.Prisma.Decimal(decimalToNumber(existing === null || existing === void 0 ? void 0 : existing.line_discount));
            const lineTotal = lineSubtotal.sub(discountDecimal);
            const resolvedImage = typeof image === "string" && image.trim() !== ""
                ? image.trim()
                : (existing === null || existing === void 0 ? void 0 : existing.image_url) ||
                    ((_c = variantWithProduct.images) === null || _c === void 0 ? void 0 : _c[0]) ||
                    variantWithProduct.products.thumbnail ||
                    null;
            if (existing) {
                yield tx.cart_items.update({
                    where: {
                        cart_id_variant_id: {
                            cart_id: cart.id,
                            variant_id: variantWithProduct.id,
                        },
                    },
                    data: {
                        quantity: newQuantity,
                        size: typeof size === "string" ? size : existing.size,
                        color: normalizedColor !== null && normalizedColor !== void 0 ? normalizedColor : existing.color,
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
                        variant_id: variantWithProduct.id,
                        image_url: resolvedImage,
                        size: typeof size === "string" ? size : null,
                        color: (_d = normalizedColor !== null && normalizedColor !== void 0 ? normalizedColor : variantWithProduct.color) !== null && _d !== void 0 ? _d : null,
                        price_unit: unitPriceDecimal,
                        quantity: parsedQuantity,
                        line_subtotal: unitPriceDecimal.mul(new client_1.Prisma.Decimal(parsedQuantity)),
                        line_discount: new client_1.Prisma.Decimal(0),
                        line_total: unitPriceDecimal.mul(new client_1.Prisma.Decimal(parsedQuantity)),
                    },
                });
            }
            const aggregates = yield tx.cart_items.aggregate({
                where: { cart_id: cart.id },
                _sum: {
                    quantity: true,
                    line_total: true,
                },
            });
            const sessionSource = (yield tx.cart_items.findMany({
                where: { cart_id: cart.id },
                include: CART_INCLUDE.cart_items.include,
                orderBy: { id: "asc" },
            }));
            yield tx.carts.update({
                where: { id: cart.id },
                data: {
                    grand_total: new client_1.Prisma.Decimal(decimalToNumber(aggregates._sum.line_total)),
                    updated_at: new Date(),
                },
            });
            return {
                cartId: cart.id,
                created,
                cartQuantity: (_e = aggregates._sum.quantity) !== null && _e !== void 0 ? _e : 0,
                sessionItems: sessionSource,
            };
        }));
        const sessionItems = buildSessionItems(result.sessionItems);
        syncSessionCart(req, sessionItems);
        res.locals.cartQuantity = result.cartQuantity;
        if (!identifiers.cartId || identifiers.cartId !== result.cartId) {
            res.cookie(CART_COOKIE_NAME, result.cartId, {
                httpOnly: true,
                sameSite: "lax",
                maxAge: CART_COOKIE_MAX_AGE,
            });
        }
        return res.status(200).json({
            success: true,
            message: "Đã thêm vào giỏ hàng.",
            cartQuantity: result.cartQuantity,
            data: {
                cartId: result.cartId,
                productId,
                slug: (_b = slug !== null && slug !== void 0 ? slug : variantWithProduct.products.slug) !== null && _b !== void 0 ? _b : null,
                title: title !== null && title !== void 0 ? title : variantWithProduct.products.title,
            },
        });
    }
    catch (error) {
        if (error instanceof CartOperationError) {
            const statusCode = error.code === "NOT_FOUND" ? 404 : 400;
            return res.status(statusCode).json({
                success: false,
                message: error.message,
                details: error.details,
            });
        }
        console.error("CART ADD ITEM ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Không thể thêm sản phẩm vào giỏ hàng.",
        });
    }
});
exports.addItem = addItem;
