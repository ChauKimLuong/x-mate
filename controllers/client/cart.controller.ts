import { Prisma, cart_items, carts } from "@prisma/client";
import { Request, Response } from "express";
import prisma from "../../config/database";

const CART_COOKIE_NAME = "cart_id";
const CART_COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30 days
const FREE_SHIP_THRESHOLD = 500_000;
const SHIPPING_FEE = 30_000;

interface SessionCartItem {
    productId: string;
    slug?: string | null;
    title: string;
    price: number;
    size?: string | null;
    color?: string | null;
    quantity: number;
    image?: string | null;
    variantId?: string;
}

type CartItemWithRelations = cart_items & {
    products: {
        id: string;
        title: string;
        slug: string | null;
        price: number;
        discount: number;
        thumbnail: string | null;
        size: string[];
    } | null;
    productVariants: {
        id: string;
        color: string | null;
        images: string[];
        stock: number;
    } | null;
};

class CartOperationError extends Error {
    constructor(
        public code: "OUT_OF_STOCK" | "INVALID_SIZE" | "NOT_FOUND",
        message: string,
        public details?: Record<string, unknown>
    ) {
        super(message);
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
        orderBy: { id: "asc" as const },
    },
};

const decimalToNumber = (
    value: Prisma.Decimal | number | string | null | undefined
): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    if (value instanceof Prisma.Decimal) {
        return Number(value.toString());
    }
    return 0;
};

const toCurrency = (value: number): string => {
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

const normalizeColor = (input: unknown): string | null => {
    if (typeof input !== "string") return null;
    const trimmed = input.trim();
    return trimmed ? trimmed : null;
};

const getCartCookieId = (req: Request): number | undefined => {
    const raw =
        (req.cookies?.[CART_COOKIE_NAME] as string | undefined) ??
        (req.cookies?.cartId as string | undefined);
    if (!raw) return undefined;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const getTokenUser = (req: Request): string | undefined => {
    const token = req.cookies?.token_user;
    return typeof token === "string" && token.trim() !== "" ? token : undefined;
};

const syncSessionCart = (req: Request, items: SessionCartItem[]) => {
    if (!req.session) return;
    (req.session as any).cart = items;
};

const buildSessionItems = (items: CartItemWithRelations[]): SessionCartItem[] => {
    return items.map((item) => ({
        productId: item.product_id,
        slug: item.products?.slug ?? undefined,
        title: item.products?.title ?? "Sản phẩm",
        price: decimalToNumber(item.price_unit),
        size: item.size ?? undefined,
        color: item.color ?? undefined,
        quantity: item.quantity ?? 0,
        image:
            item.image_url ||
            item.productVariants?.images?.[0] ||
            item.products?.thumbnail ||
            undefined,
        variantId: item.variant_id,
    }));
};

const buildCartView = (items: CartItemWithRelations[]) => {
    const sessionItems = buildSessionItems(items);

    let subtotal = 0;
    let discount = 0;

    const viewItems = items.map((item) => {
        const unitPrice = decimalToNumber(item.price_unit);
        const lineSubtotalRaw =
            item.line_subtotal !== null && item.line_subtotal !== undefined
                ? decimalToNumber(item.line_subtotal)
                : unitPrice * (item.quantity ?? 0);
        const lineDiscountRaw =
            item.line_discount !== null && item.line_discount !== undefined
                ? decimalToNumber(item.line_discount)
                : 0;
        const lineTotalRaw =
            item.line_total !== null && item.line_total !== undefined
                ? decimalToNumber(item.line_total)
                : lineSubtotalRaw - lineDiscountRaw;

        subtotal += lineSubtotalRaw;
        discount += lineDiscountRaw;

        return {
            id: item.id,
            productId: item.product_id,
            variantId: item.variant_id,
            title: item.products?.title ?? "Sản phẩm",
            slug: item.products?.slug ?? "",
            image:
                item.image_url ||
                item.productVariants?.images?.[0] ||
                item.products?.thumbnail ||
                "",
            color: item.color ?? item.productVariants?.color ?? null,
            size: item.size ?? null,
            quantity: item.quantity ?? 0,
            unitPrice,
            unitPriceText: toCurrency(unitPrice),
            lineSubtotal: lineSubtotalRaw,
            lineSubtotalText: toCurrency(lineSubtotalRaw),
            lineDiscount: lineDiscountRaw,
            lineDiscountText:
                lineDiscountRaw > 0 ? `- ${toCurrency(lineDiscountRaw)}` : toCurrency(0),
            lineTotal: lineTotalRaw,
            lineTotalText: toCurrency(lineTotalRaw),
        };
    });

    const quantity = items.reduce(
        (sum, item) => sum + (item.quantity ?? 0),
        0
    );
    const totalBeforeShipping = Math.max(0, subtotal - discount);
    const shipping =
        quantity === 0
            ? 0
            : totalBeforeShipping >= FREE_SHIP_THRESHOLD
            ? 0
            : SHIPPING_FEE;
    const total = totalBeforeShipping + shipping;
    const freeShipRemaining = Math.max(FREE_SHIP_THRESHOLD - totalBeforeShipping, 0);
    const freeShipProgress =
        FREE_SHIP_THRESHOLD > 0
            ? Math.min(
                  100,
                  Math.round((totalBeforeShipping / FREE_SHIP_THRESHOLD) * 100)
              )
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
        statusText:
            quantity === 0
                ? "Bắt đầu thêm sản phẩm vào giỏ để nhận ưu đãi miễn phí vận chuyển."
                : freeShipReached
                ? "Bạn đã đủ điều kiện miễn phí vận chuyển!"
                : `Thêm ${toCurrency(freeShipRemaining)} để được miễn phí vận chuyển.`,
    };

    return { viewItems, totals, sessionItems, freeShip };
};

const formatDate = (value: Date | null | undefined): string => {
    if (!value) return "Không thời hạn";
    return new Intl.DateTimeFormat("vi-VN").format(value);
};

const mapVoucherView = (rows: { code: string; title: string; enddate: Date | null; usagelimit: number | null; usedcount: number; type: string; discountvalue: Prisma.Decimal; minordervalue: Prisma.Decimal | null; maxdiscount: Prisma.Decimal | null; }[]) => {
    const now = new Date();
    return rows.map((coupon) => {
        const remaining =
            typeof coupon.usagelimit === "number"
                ? Math.max(coupon.usagelimit - coupon.usedcount, 0)
                : null;
        const isExpired = coupon.enddate ? coupon.enddate < now : false;
        const disabled =
            (remaining !== null && remaining <= 0) || isExpired;

        const discountValue = toCurrency(decimalToNumber(coupon.discountvalue));
        const minOrder =
            coupon.minordervalue !== null && coupon.minordervalue !== undefined
                ? toCurrency(decimalToNumber(coupon.minordervalue))
                : null;

        const benefit =
            coupon.type === "PERCENT"
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

const ensureCartRecord = async (
    tx: Prisma.TransactionClient,
    identifiers: { cartId?: number; tokenUser?: string }
) => {
    const { cartId, tokenUser } = identifiers;
    let created = false;
    let reassigned = false;
    let cart: carts | null = null;

    if (tokenUser) {
        cart = await tx.carts.findFirst({
            where: { token_user: tokenUser },
        });
    }

    if (!cart && cartId) {
        cart = await tx.carts.findUnique({ where: { id: cartId } });
        if (cart && tokenUser && cart.token_user !== tokenUser) {
            cart = await tx.carts.update({
                where: { id: cart.id },
                data: { token_user: tokenUser },
            });
            reassigned = true;
        }
    }

    if (!cart) {
        cart = await tx.carts.create({
            data: {
                token_user: tokenUser ?? null,
            },
        });
        created = true;
    }

    return { cart, created, reassigned };
};

export const index = async (req: Request, res: Response) => {
    try {
        const tokenUser = getTokenUser(req);
        const cookieCartId = getCartCookieId(req);

        let cart = null;

        if (tokenUser) {
            cart = await prisma.carts.findFirst({
                where: { token_user: tokenUser },
                include: CART_INCLUDE,
            });
        }

        if (!cart && cookieCartId) {
            cart = await prisma.carts.findUnique({
                where: { id: cookieCartId },
                include: CART_INCLUDE,
            });
            if (cart && tokenUser && cart.token_user !== tokenUser) {
                await prisma.carts.update({
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
        } else if (cookieCartId) {
            res.clearCookie(CART_COOKIE_NAME);
        }

        const items = (cart?.cart_items ?? []) as CartItemWithRelations[];
        const { viewItems, totals, sessionItems, freeShip } = buildCartView(items);
        syncSessionCart(req, sessionItems);
        res.locals.cartQuantity = totals.quantity;

        const voucherRows = await prisma.coupons.findMany({
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
    } catch (error) {
        console.error("CART INDEX ERROR:", error);
        res.status(500).render("client/pages/cart/index", {
            cart: { items: [], totals: makeEmptyTotals(), isEmpty: true },
            freeShip: { ...makeEmptyFreeShip(), statusText: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau." },
            vouchers: [],
        });
    }
};

export const addItem = async (req: Request, res: Response) => {
    try {
        if (!req.session) {
            return res.status(400).json({
                success: false,
                message: "Session không khả dụng.",
            });
        }

        const {
            productId,
            slug,
            title,
            size,
            color,
            quantity = 1,
            image,
        } = req.body ?? {};

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

        const variantWithProduct =
            await prisma.productVariants.findFirst({
                where: {
                    productId,
                    ...(normalizedColor
                        ? {
                              color: {
                                  equals: normalizedColor,
                                  mode: "insensitive",
                              },
                          }
                        : {}),
                },
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
            }) ||
            (await prisma.productVariants.findFirst({
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
        if (
            typeof size === "string" &&
            allowedSizes.length > 0 &&
            !allowedSizes.includes(size)
        ) {
            throw new CartOperationError(
                "INVALID_SIZE",
                "Kích thước không hợp lệ cho sản phẩm này."
            );
        }

        const basePrice = Number(variantWithProduct.products.price) || 0;
        const discountPercent = Number(variantWithProduct.products.discount) || 0;
        const discountedPrice = Math.round(
            (basePrice * (100 - discountPercent)) / 100
        );
        const unitPriceNumber =
            discountedPrice > 0 ? discountedPrice : Math.max(0, basePrice);
        const unitPriceDecimal = new Prisma.Decimal(unitPriceNumber);

        const identifiers = {
            cartId: getCartCookieId(req),
            tokenUser: getTokenUser(req),
        };

        const result = await prisma.$transaction(async (tx) => {
            const { cart, created } = await ensureCartRecord(tx, identifiers);

            const existing = await tx.cart_items.findUnique({
                where: {
                    cart_id_variant_id: {
                        cart_id: cart.id,
                        variant_id: variantWithProduct.id,
                    },
                },
            });

            const newQuantity = (existing?.quantity ?? 0) + parsedQuantity;
            const variantStock = variantWithProduct.stock ?? 0;
            if (variantStock > 0 && newQuantity > variantStock) {
                throw new CartOperationError("OUT_OF_STOCK", "Số lượng vượt quá tồn kho.", {
                    stock: variantStock,
                });
            }

            const lineSubtotal = unitPriceDecimal.mul(
                new Prisma.Decimal(newQuantity)
            );
            const discountDecimal = new Prisma.Decimal(
                decimalToNumber(existing?.line_discount)
            );
            const lineTotal = lineSubtotal.sub(discountDecimal);
            const resolvedImage =
                typeof image === "string" && image.trim() !== ""
                    ? image.trim()
                    : existing?.image_url ||
                      variantWithProduct.images?.[0] ||
                      variantWithProduct.products.thumbnail ||
                      null;

            if (existing) {
                await tx.cart_items.update({
                    where: {
                        cart_id_variant_id: {
                            cart_id: cart.id,
                            variant_id: variantWithProduct.id,
                        },
                    },
                    data: {
                        quantity: newQuantity,
                        size: typeof size === "string" ? size : existing.size,
                        color: normalizedColor ?? existing.color,
                        price_unit: unitPriceDecimal,
                        line_subtotal: lineSubtotal,
                        line_discount: discountDecimal,
                        line_total: lineTotal,
                        image_url: resolvedImage,
                    },
                });
            } else {
                await tx.cart_items.create({
                    data: {
                        cart_id: cart.id,
                        product_id: productId,
                        variant_id: variantWithProduct.id,
                        image_url: resolvedImage,
                        size: typeof size === "string" ? size : null,
                        color:
                            normalizedColor ?? variantWithProduct.color ?? null,
                        price_unit: unitPriceDecimal,
                        quantity: parsedQuantity,
                        line_subtotal: unitPriceDecimal.mul(
                            new Prisma.Decimal(parsedQuantity)
                        ),
                        line_discount: new Prisma.Decimal(0),
                        line_total: unitPriceDecimal.mul(
                            new Prisma.Decimal(parsedQuantity)
                        ),
                    },
                });
            }

            const aggregates = await tx.cart_items.aggregate({
                where: { cart_id: cart.id },
                _sum: {
                    quantity: true,
                    line_total: true,
                },
            });

            const sessionSource = (await tx.cart_items.findMany({
                where: { cart_id: cart.id },
                include: CART_INCLUDE.cart_items.include,
                orderBy: { id: "asc" },
            })) as CartItemWithRelations[];

            await tx.carts.update({
                where: { id: cart.id },
                data: {
                    grand_total: new Prisma.Decimal(
                        decimalToNumber(aggregates._sum.line_total)
                    ),
                    updated_at: new Date(),
                },
            });

            return {
                cartId: cart.id,
                created,
                cartQuantity: aggregates._sum.quantity ?? 0,
                sessionItems: sessionSource,
            };
        });

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
                slug: slug ?? variantWithProduct.products.slug ?? null,
                title: title ?? variantWithProduct.products.title,
            },
        });
    } catch (error: unknown) {
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
};
