import { NextFunction, Request, Response } from "express";
import prisma from "../../config/database";

const CART_COOKIE_NAME = "cart_id";

const readCookieCartId = (req: Request): number | undefined => {
    const raw =
        (req.cookies?.[CART_COOKIE_NAME] as string | undefined) ??
        (req.cookies?.cartId as string | undefined);
    if (!raw) return undefined;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const readTokenUser = (req: Request): string | undefined => {
    const raw = req.cookies?.token_user;
    if (typeof raw !== "string") return undefined;
    const trimmed = raw.trim();
    return trimmed ? trimmed : undefined;
};

const sumSessionCart = (sessionCart: unknown): number => {
    if (!Array.isArray(sessionCart)) return 0;
    return sessionCart.reduce((total: number, item: any) => {
        const quantity =
            item && typeof item.quantity === "number" && Number.isFinite(item.quantity)
                ? item.quantity
                : 0;
        return total + quantity;
    }, 0);
};

const toSafeNumber = (value: unknown): number => {
    if (typeof value === "number") return value;
    if (typeof value === "bigint") return Number(value);
    if (value && typeof value === "object" && "toString" in value) {
        const parsed = Number((value as any).toString());
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

export const cartQuantityMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    let cartQuantity = 0;

    try {
        let cartId = readCookieCartId(req);
        const tokenUser = readTokenUser(req);

        if (tokenUser) {
            const cartByToken = await prisma.carts.findFirst({
                where: { token_user: tokenUser },
                select: { id: true },
            });
            if (cartByToken?.id) {
                cartId = cartByToken.id;
            }
        }

        if (cartId) {
            const aggregate = await prisma.cart_items.aggregate({
                where: { cart_id: cartId },
                _sum: { quantity: true },
            });
            cartQuantity = toSafeNumber(aggregate._sum.quantity);
        }

        if (cartQuantity <= 0) {
            cartQuantity = sumSessionCart((req.session as any)?.cart);
        }
    } catch (error) {
        console.error("CART_QUANTITY_MIDDLEWARE_ERROR:", error);
        cartQuantity = sumSessionCart((req.session as any)?.cart);
    }

    res.locals.cartQuantity = cartQuantity > 0 ? cartQuantity : 0;
    next();
};

export default cartQuantityMiddleware;
