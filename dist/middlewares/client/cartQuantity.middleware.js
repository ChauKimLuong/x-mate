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
exports.cartQuantityMiddleware = void 0;
const database_1 = __importDefault(require("../../config/database"));
const CART_COOKIE_NAME = "cart_id";
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
const sumSessionCart = (sessionCart) => {
    if (!Array.isArray(sessionCart))
        return 0;
    return sessionCart.reduce((total, item) => {
        const quantity = item && typeof item.quantity === "number" && Number.isFinite(item.quantity)
            ? item.quantity
            : 0;
        return total + quantity;
    }, 0);
};
const toSafeNumber = (value) => {
    if (typeof value === "number")
        return value;
    if (typeof value === "bigint")
        return Number(value);
    if (value && typeof value === "object" && "toString" in value) {
        const parsed = Number(value.toString());
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};
const cartQuantityMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    let cartQuantity = 0;
    try {
        let cartId = readCookieCartId(req);
        const tokenUser = readTokenUser(req);
        if (tokenUser) {
            const cartByToken = yield database_1.default.carts.findFirst({
                where: { token_user: tokenUser },
                select: { id: true },
            });
            if (cartByToken === null || cartByToken === void 0 ? void 0 : cartByToken.id) {
                cartId = cartByToken.id;
            }
        }
        if (cartId) {
            const aggregate = yield database_1.default.cart_items.aggregate({
                where: { cart_id: cartId },
                _sum: { quantity: true },
            });
            cartQuantity = toSafeNumber(aggregate._sum.quantity);
        }
        if (cartQuantity <= 0) {
            cartQuantity = sumSessionCart((_a = req.session) === null || _a === void 0 ? void 0 : _a.cart);
        }
    }
    catch (error) {
        console.error("CART_QUANTITY_MIDDLEWARE_ERROR:", error);
        cartQuantity = sumSessionCart((_b = req.session) === null || _b === void 0 ? void 0 : _b.cart);
    }
    res.locals.cartQuantity = cartQuantity > 0 ? cartQuantity : 0;
    next();
});
exports.cartQuantityMiddleware = cartQuantityMiddleware;
exports.default = exports.cartQuantityMiddleware;
