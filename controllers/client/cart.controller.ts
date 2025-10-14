import { Prisma, cart_items, carts } from "@prisma/client";
import { Request, Response } from "express";
import prisma from "../../config/database";

const CART_COOKIE_NAME = "cart_id";
const CART_COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30 ngày
const FREE_SHIP_THRESHOLD = 500_000;
const SHIPPING_FEE = 30_000;

type CartItemWithRelations = cart_items & {
    products: {
        id: string;
        title: string;
        slug: string | null;
        price: Prisma.Decimal | number;
        discount: Prisma.Decimal | number;
        thumbnail: string | null;
        size: string[] | null;
    } | null;
    productVariants: {
        id: string;
        color: string | null;
        images: string[];
        stock: number | null;
    } | null;
};

type CartWithRelations = carts & {
    cart_items: CartItemWithRelations[];
    shipping_fee?: Prisma.Decimal | number | null;
    coupon_id?: number | null;
};

interface SessionCartItem {
    productId: string;
    slug?: string | null;
    title: string;
    price: number;
    size?: string | null;
    color?: string | null;
    quantity: number;
    image?: string | null;
    variantId?: string | null;
}

interface CartIdentifiers {
    cartId?: number;
    tokenUser?: string;
}

interface CartMutationResult {
    cartId: number;
    cartQuantity: number;
    items: CartItemWithRelations[];
}

type CouponRow = {
    couponid: number;
    code: string;
    title: string;
    type: string;
    discountvalue: Prisma.Decimal | number | string;
    minordervalue: Prisma.Decimal | number | string | null;
    maxdiscount: Prisma.Decimal | number | string | null;
    status: string;
    startdate: Date | null;
    enddate: Date | null;
};

const CART_INCLUDE = {
    cart_items: {
        include: {
            products: true,
            productVariants: true,
        },
        orderBy: { id: "asc" as const },
    },
};

const asNumber = (
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

const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
    }).format(Math.max(0, Math.round(value)));
};

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

const keepCartInSession = (req: Request, items: SessionCartItem[]) => {
    if (!req.session) return;
    (req.session as any).cart = items;
};

const getRedirectTarget = (req: Request): string | undefined => {
    const raw = req.body?.redirect;
    if (typeof raw !== "string") return undefined;
    const trimmed = raw.trim();
    if (!trimmed || !trimmed.startsWith("/")) return undefined;
    return trimmed;
};

const redirectWithMessage = (
    req: Request,
    res: Response,
    target: string,
    message?: { type: "success" | "error"; text: string }
) => {
    if (message && typeof (req as any).flash === "function") {
        (req as any).flash(message.type, message.text);
    }
    return res.redirect(target);
};

const formatDate = (value: Date | null | undefined): string => {
    if (!value) return "Không thời hạn";
    return new Intl.DateTimeFormat("vi-VN").format(value);
};

const fetchVouchers = async () => {
    const rows = await prisma.coupons.findMany({
        where: { status: "ACTIVE" },
        orderBy: { startdate: "desc" },
        take: 6,
    });
    const now = new Date();

    return rows.map((coupon) => {
        const discountValueNumber = asNumber(coupon.discountvalue);
        const maxDiscountNumber = asNumber(coupon.maxdiscount);
        const minOrderNumber = asNumber(coupon.minordervalue);

        const remaining =
            typeof coupon.usagelimit === "number"
                ? Math.max(coupon.usagelimit - coupon.usedcount, 0)
                : null;
        const expired = coupon.enddate ? coupon.enddate < now : false;
        const disabled =
            (remaining !== null && remaining <= 0) || expired;

        const minOrder =
            coupon.minordervalue !== null && coupon.minordervalue !== undefined
                ? formatCurrency(minOrderNumber)
                : null;

        const benefit =
            coupon.type === "PERCENT"
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
};

const buildCartData = (items: CartItemWithRelations[]) => {
    const viewItems = items.map((item) => {
        const quantity = item.quantity ?? 0;
        const unitPrice = asNumber(item.price_unit);
        const lineSubtotal =
            item.line_subtotal !== null && item.line_subtotal !== undefined
                ? asNumber(item.line_subtotal)
                : unitPrice * quantity;
        const lineDiscount =
            item.line_discount !== null && item.line_discount !== undefined
                ? asNumber(item.line_discount)
                : 0;
        const lineTotal =
            item.line_total !== null && item.line_total !== undefined
                ? asNumber(item.line_total)
                : Math.max(0, lineSubtotal - lineDiscount);

        const image =
            item.image_url ||
            item.productVariants?.images?.[0] ||
            item.products?.thumbnail ||
            "";

        return {
            id: item.id,
            productId: item.product_id,
            variantId: item.variant_id,
            title: item.products?.title ?? "Sản phẩm",
            slug: item.products?.slug ?? null,
            image,
            color: item.color ?? item.productVariants?.color ?? null,
            size: item.size ?? null,
            quantity,
            unitPrice,
            unitPriceText: formatCurrency(unitPrice),
            lineSubtotal,
            lineSubtotalText: formatCurrency(lineSubtotal),
            lineDiscount,
            lineDiscountText:
                lineDiscount > 0
                    ? `- ${formatCurrency(lineDiscount)}`
                    : formatCurrency(0),
            lineTotal,
            lineTotalText: formatCurrency(lineTotal),
        };
    });

    const subtotal = viewItems.reduce(
        (sum, item) => sum + item.lineSubtotal,
        0
    );
    const discount = viewItems.reduce(
        (sum, item) => sum + item.lineDiscount,
        0
    );
    const quantity = viewItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalBeforeShipping = Math.max(0, subtotal - discount);
    const shipping =
        quantity === 0 || totalBeforeShipping >= FREE_SHIP_THRESHOLD
            ? 0
            : SHIPPING_FEE;
    const total = totalBeforeShipping + shipping;
    const freeShipRemaining = Math.max(
        FREE_SHIP_THRESHOLD - totalBeforeShipping,
        0
    );
    const freeShipProgress =
        FREE_SHIP_THRESHOLD > 0
            ? Math.min(
                  100,
                  Math.round(
                      (totalBeforeShipping / FREE_SHIP_THRESHOLD) * 100
                  )
              )
            : 0;
    const freeShipReached = quantity > 0 && freeShipRemaining === 0;

    const totals = {
        quantity,
        subtotal,
        subtotalText: formatCurrency(subtotal),
        discount,
        discountText:
            discount > 0
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
        headerText: `Miễn phí vận chuyển cho đơn từ ${formatCurrency(
            FREE_SHIP_THRESHOLD
        )}`,
        thresholdText: formatCurrency(FREE_SHIP_THRESHOLD),
        progressPercent: freeShipProgress,
        remainingText: formatCurrency(freeShipRemaining),
        reached: freeShipReached,
        statusText:
            quantity === 0
                ? "Bắt đầu thêm sản phẩm vào giỏ để nhận ưu đãi miễn phí vận chuyển."
                : freeShipReached
                ? "Bạn đã đủ điều kiện miễn phí vận chuyển!"
                : `Thêm ${formatCurrency(
                      freeShipRemaining
                  )} để được miễn phí vận chuyển.`,
    };

    const sessionItems: SessionCartItem[] = viewItems.map((item) => ({
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

const applyCouponToSummary = (
    summary: ReturnType<typeof buildCartData>,
    coupon: CouponRow | null
) => {
    if (!coupon || typeof coupon !== "object") {
        return {
            summary,
            couponInfo: null as null | {
                id: number;
                code: string;
                title: string;
                type: string;
            },
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

    const updatedSummary = {
        ...summary,
        totals: { ...summary.totals },
    };

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
    } else if (type === "FREESHIP") {
        shipping = 0;
        if (discountValue > 0) {
            extraDiscount = discountValue;
        }
    } else {
        extraDiscount = discountValue;
    }

    if (extraDiscount < 0) extraDiscount = 0;

    const totalDiscount = existingDiscount + extraDiscount;
    const totalBeforeShipping = Math.max(0, subtotal - totalDiscount);
    const total = totalBeforeShipping + shipping;

    updatedSummary.totals = {
        ...updatedSummary.totals,
        discount: totalDiscount,
        discountText:
            totalDiscount > 0
                ? `- ${formatCurrency(totalDiscount)}`
                : formatCurrency(0),
        shipping,
        shippingText: formatCurrency(shipping),
        totalBeforeShipping,
        totalBeforeShippingText: formatCurrency(totalBeforeShipping),
        total,
        totalText: formatCurrency(total),
    };

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

const findExistingCart = async (
    identifiers: CartIdentifiers
): Promise<CartWithRelations | null> => {
    const { cartId, tokenUser } = identifiers;

    if (tokenUser) {
        const cart = await prisma.carts.findFirst({
            where: { token_user: tokenUser },
            include: CART_INCLUDE,
        });
        if (cart) {
            return cart as CartWithRelations;
        }
    }

    if (cartId) {
        const cart = await prisma.carts.findUnique({
            where: { id: cartId },
            include: CART_INCLUDE,
        });
        if (cart && tokenUser && cart.token_user !== tokenUser) {
            await prisma.carts.update({
                where: { id: cart.id },
                data: { token_user: tokenUser },
            });
            cart.token_user = tokenUser;
        }
        return cart ? (cart as CartWithRelations) : null;
    }

    return null;
};

const ensureCart = async (
    tx: Prisma.TransactionClient,
    identifiers: CartIdentifiers
) => {
    const { cartId, tokenUser } = identifiers;
    let created = false;

    let cart: carts | null = tokenUser
        ? await tx.carts.findFirst({ where: { token_user: tokenUser } })
        : null;

    if (!cart && cartId) {
        cart = await tx.carts.findUnique({ where: { id: cartId } });
    }

    if (!cart) {
        cart = await tx.carts.create({
            data: {
                token_user: tokenUser ?? null,
            },
        });
        created = true;
    } else if (tokenUser && cart.token_user !== tokenUser) {
        cart = await tx.carts.update({
            where: { id: cart.id },
            data: { token_user: tokenUser },
        });
    }

    return { cart, created };
};

const recalculateCart = async (
    tx: Prisma.TransactionClient,
    cartId: number,
    tokenUser?: string
): Promise<CartMutationResult> => {
    const aggregates = await tx.cart_items.aggregate({
        where: { cart_id: cartId },
        _sum: {
            quantity: true,
            line_total: true,
        },
    });

    const items = (await tx.cart_items.findMany({
        where: { cart_id: cartId },
        include: CART_INCLUDE.cart_items.include,
        orderBy: { id: "asc" },
    })) as CartItemWithRelations[];

    await tx.carts.update({
        where: { id: cartId },
        data: {
            grand_total: new Prisma.Decimal(
                asNumber(aggregates._sum.line_total)
            ),
            updated_at: new Date(),
            ...(tokenUser ? { token_user: tokenUser } : {}),
        },
    });

    return {
        cartId,
        cartQuantity: aggregates._sum.quantity ?? 0,
        items,
    };
};

const finalizeCartMutation = (
    req: Request,
    res: Response,
    identifiers: CartIdentifiers,
    result: CartMutationResult
) => {
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

export const index = async (req: Request, res: Response) => {
    const identifiers = {
        cartId: readCookieCartId(req),
        tokenUser: readTokenUser(req),
    };

    try {
        const cart = await findExistingCart(identifiers);

        if (cart && identifiers.cartId !== cart.id) {
            res.cookie(CART_COOKIE_NAME, cart.id, {
                httpOnly: true,
                sameSite: "lax",
                maxAge: CART_COOKIE_MAX_AGE,
            });
        } else if (!cart && identifiers.cartId) {
            res.clearCookie(CART_COOKIE_NAME);
        }

        let summary = buildCartData(
            (cart?.cart_items ?? []) as CartItemWithRelations[]
        );
        keepCartInSession(req, summary.sessionItems);
        res.locals.cartQuantity = summary.totals.quantity;

        const vouchers = await fetchVouchers();

        let appliedCoupon:
            | {
                  code: string;
                  title: string;
                  type: string;
              }
            | null = null;

        if (cart?.coupon_id) {
            const couponRow = await prisma.coupons.findUnique({
                where: { couponid: cart.coupon_id },
            });
            if (couponRow) {
                const result = applyCouponToSummary(
                    summary,
                    couponRow as unknown as CouponRow
                );
                summary = result.summary;
                if (result.couponInfo) {
                    appliedCoupon = {
                        code: result.couponInfo.code,
                        title: result.couponInfo.title,
                        type: result.couponInfo.type,
                    };
                }
            }
        } else if (req.session && (req.session as any).cartCoupon) {
            const sessionCoupon = (req.session as any).cartCoupon;
            if (sessionCoupon && sessionCoupon.code) {
                const couponRow = await prisma.coupons.findFirst({
                    where: {
                        code: {
                            equals: sessionCoupon.code,
                            mode: "insensitive",
                        },
                    },
                });
                if (couponRow) {
                    const result = applyCouponToSummary(
                        summary,
                        couponRow as unknown as CouponRow
                    );
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
        });
    } catch (error) {
        console.error("CART INDEX ERROR:", error);
        const emptySummary = buildCartData([] as CartItemWithRelations[]);

        res.status(500).render("client/pages/cart/index", {
            cart: {
                items: [],
                totals: emptySummary.totals,
                isEmpty: true,
                coupon: null,
            },
            freeShip: {
                ...emptySummary.freeShip,
                statusText:
                    "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
            },
            vouchers: [],
        });
    }
};

export const addItem = async (req: Request, res: Response) => {
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

    const normalizedColor =
        typeof color === "string" && color.trim() !== ""
            ? color.trim()
            : undefined;
    const parsedQuantity = Number.isFinite(Number(quantity))
        ? Math.max(1, Math.floor(Number(quantity)))
        : 1;

    const variant =
        (await prisma.productVariants.findFirst({
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
                products: true,
            },
        })) ||
        (await prisma.productVariants.findFirst({
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

    if (
        typeof size === "string" &&
        allowedSizes.length > 0 &&
        !allowedSizes.includes(size)
    ) {
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
    const discountedPrice =
        discountPercent > 0
            ? Math.round((basePrice * (100 - discountPercent)) / 100)
            : basePrice;
    const unitPrice = Math.max(0, discountedPrice);
    const unitPriceDecimal = new Prisma.Decimal(unitPrice);

    const txResult = await prisma.$transaction(async (tx) => {
        const { cart } = await ensureCart(tx, identifiers);

        const existing = await tx.cart_items.findUnique({
            where: {
                cart_id_variant_id: {
                    cart_id: cart.id,
                    variant_id: variant.id,
                },
            },
        });

        const nextQuantity = (existing?.quantity ?? 0) + parsedQuantity;
        const stock = variant.stock ?? 0;
        if (stock > 0 && nextQuantity > stock) {
            return {
                status: "OUT_OF_STOCK" as const,
                stock,
            };
        }

        const resolvedImage =
            typeof image === "string" && image.trim() !== ""
                ? image.trim()
                : existing?.image_url ||
                  variant.images?.[0] ||
                  variant.products.thumbnail ||
                  null;

        const discountDecimal = new Prisma.Decimal(
            asNumber(existing?.line_discount)
        );
        const lineSubtotal = unitPriceDecimal.mul(
            new Prisma.Decimal(nextQuantity)
        );
        const lineTotalCandidate = lineSubtotal.sub(discountDecimal);
        const lineTotal = lineTotalCandidate.lessThan(0)
            ? new Prisma.Decimal(0)
            : lineTotalCandidate;

        if (existing) {
            await tx.cart_items.update({
                where: {
                    cart_id_variant_id: {
                        cart_id: cart.id,
                        variant_id: variant.id,
                    },
                },
                data: {
                    quantity: nextQuantity,
                    size:
                        typeof size === "string"
                            ? size
                            : existing.size,
                    color:
                        normalizedColor ??
                        existing.color ??
                        variant.color ??
                        null,
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
                    variant_id: variant.id,
                    quantity: nextQuantity,
                    size: typeof size === "string" ? size : null,
                    color:
                        normalizedColor ??
                        variant.color ??
                        null,
                    price_unit: unitPriceDecimal,
                    line_subtotal: lineSubtotal,
                    line_discount: discountDecimal,
                    line_total: lineTotal,
                    image_url: resolvedImage,
                },
            });
        }

        const payload = await recalculateCart(
            tx,
            cart.id,
            identifiers.tokenUser
        );

        return {
            status: "OK" as const,
            payload,
        };
    });

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

    const summary = finalizeCartMutation(
        req,
        res,
        identifiers,
        txResult.payload
    );

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
            slug:
                typeof slug === "string"
                    ? slug
                    : variant.products.slug ?? null,
            title:
                typeof title === "string"
                    ? title
                    : variant.products.title,
        },
    });
};

export const updateItemQuantity = async (req: Request, res: Response) => {
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

    const rawItemId =
        req.body?.itemId ?? req.params?.itemId ?? req.params?.id;
    const itemId = Number.parseInt(String(rawItemId ?? ""), 10);

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

    const cart = await findExistingCart(identifiers);
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

    const txResult = await prisma.$transaction(async (tx) => {
        const cartItem = await tx.cart_items.findFirst({
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
                status: "NOT_FOUND" as const,
            };
        }

        const currentQuantity = cartItem.quantity ?? 0;

        const quantityValue = Number(req.body?.quantity);
        const deltaValue = Number(req.body?.delta ?? req.body?.change);
        const actionRaw = typeof req.body?.action === "string"
            ? (req.body.action as string).toLowerCase()
            : undefined;

        let nextQuantity: number | undefined;
        if (actionRaw === "increase") {
            nextQuantity = currentQuantity + 1;
        } else if (actionRaw === "decrease") {
            nextQuantity = currentQuantity - 1;
        } else if (actionRaw === "set" || actionRaw === "update") {
            if (Number.isFinite(quantityValue)) {
                nextQuantity = Math.floor(quantityValue);
            }
        } else if (Number.isFinite(deltaValue)) {
            nextQuantity = currentQuantity + Math.floor(deltaValue);
        } else if (Number.isFinite(quantityValue)) {
            nextQuantity = Math.floor(quantityValue);
        }

        if (nextQuantity === undefined || !Number.isFinite(nextQuantity)) {
            return {
                status: "INVALID" as const,
            };
        }

        nextQuantity = Math.floor(nextQuantity);
        if (nextQuantity < 0) {
            nextQuantity = 0;
        }

        const stock = cartItem.productVariants?.stock ?? 0;
        if (stock > 0 && nextQuantity > stock) {
            return {
                status: "OUT_OF_STOCK" as const,
                stock,
            };
        }

        if (nextQuantity === 0) {
            await tx.cart_items.delete({
                where: { id: cartItem.id },
            });
        } else {
            const unitPriceDecimal = new Prisma.Decimal(
                asNumber(cartItem.price_unit)
            );
            const discountDecimal = new Prisma.Decimal(
                asNumber(cartItem.line_discount)
            );
            const lineSubtotal = unitPriceDecimal.mul(
                new Prisma.Decimal(nextQuantity)
            );
            const lineTotalCandidate = lineSubtotal.sub(discountDecimal);
            const lineTotal = lineTotalCandidate.lessThan(0)
                ? new Prisma.Decimal(0)
                : lineTotalCandidate;

            await tx.cart_items.update({
                where: { id: cartItem.id },
                data: {
                    quantity: nextQuantity,
                    line_subtotal: lineSubtotal,
                    line_discount: discountDecimal,
                    line_total: lineTotal,
                },
            });
        }

        const payload = await recalculateCart(
            tx,
            cart.id,
            identifiers.tokenUser
        );

        return {
            status: "OK" as const,
            payload,
        };
    });

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

    const summary = finalizeCartMutation(
        req,
        res,
        identifiers,
        txResult.payload
    );

    const updatedItem = summary.viewItems.find(
        (item) => item.id === itemId
    );

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
            quantity: updatedItem?.quantity ?? 0,
            removed: !updatedItem,
        },
    });
};

export const removeItem = async (req: Request, res: Response) => {
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

    const rawItemId =
        req.body?.itemId ?? req.params?.itemId ?? req.params?.id;
    const itemId = Number.parseInt(String(rawItemId ?? ""), 10);

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

    const cart = await findExistingCart(identifiers);
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

    const txResult = await prisma.$transaction(async (tx) => {
        const cartItem = await tx.cart_items.findFirst({
            where: {
                id: itemId,
                cart_id: cart.id,
            },
        });

        if (!cartItem) {
            return {
                status: "NOT_FOUND" as const,
            };
        }

        await tx.cart_items.delete({
            where: { id: cartItem.id },
        });

        const payload = await recalculateCart(
            tx,
            cart.id,
            identifiers.tokenUser
        );

        return {
            status: "OK" as const,
            payload,
        };
    });

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

    const summary = finalizeCartMutation(
        req,
        res,
        identifiers,
        txResult.payload
    );

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
};

export const removeSelectedItems = async (req: Request, res: Response) => {
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

    const rawIds = req.body?.itemIds;
    const idsArray = Array.isArray(rawIds) ? rawIds : rawIds ? [rawIds] : [];
    const parsedIds = idsArray
        .map((value) => Number.parseInt(String(value ?? ""), 10))
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

    const cart = await findExistingCart(identifiers);
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

    const txResult = await prisma.$transaction(async (tx) => {
        const targets = await tx.cart_items.findMany({
            where: {
                cart_id: cart.id,
                id: { in: parsedIds },
            },
            select: { id: true },
        });

        if (targets.length === 0) {
            return {
                status: "NOT_FOUND" as const,
            };
        }

        await tx.cart_items.deleteMany({
            where: {
                cart_id: cart.id,
                id: { in: parsedIds },
            },
        });

        const payload = await recalculateCart(
            tx,
            cart.id,
            identifiers.tokenUser
        );

        return {
            status: "OK" as const,
            payload,
            removedIds: targets.map((item) => item.id),
        };
    });

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

    const summary = finalizeCartMutation(
        req,
        res,
        identifiers,
        txResult.payload
    );

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
};

export const prepareCheckout = async (req: Request, res: Response) => {
    try {
        const identifiers = {
            cartId: readCookieCartId(req),
            tokenUser: readTokenUser(req),
        };

        const cart = await findExistingCart(identifiers);
        if (!cart) {
            return res.status(400).json({
                success: false,
                message: "Giỏ hàng trống.",
            });
        }

        const items = (cart.cart_items ?? []) as CartItemWithRelations[];
        if (!items.length) {
            return res.status(400).json({
                success: false,
                message: "Giỏ hàng trống.",
            });
        }

        let summary = buildCartData(items);

        const couponCode =
            typeof req.body?.couponCode === "string"
                ? req.body.couponCode.trim()
                : "";

        let couponRow: CouponRow | null = null;
        if (couponCode) {
            couponRow = await prisma.coupons.findFirst({
                where: {
                    code: {
                        equals: couponCode,
                        mode: "insensitive",
                    },
                },
            });
        } else if (cart.coupon_id) {
            couponRow = (await prisma.coupons.findUnique({
                where: { couponid: cart.coupon_id },
            })) as CouponRow | null;
        }

        let appliedCouponInfo: {
            id: number;
            code: string;
            title: string;
            type: string;
        } | null = null;

        if (couponRow) {
            const result = applyCouponToSummary(summary, couponRow);
            summary = result.summary;
            if (result.couponInfo) {
                appliedCouponInfo = result.couponInfo;
            }
        }

        const shippingFee = Math.max(
            0,
            Math.round(summary.totals.shipping ?? 0)
        );
        const grandTotal = Math.max(
            0,
            Math.round(summary.totals.total ?? 0)
        );

        await prisma.carts.update({
            where: { id: cart.id },
            data: {
                shipping_fee: new Prisma.Decimal(shippingFee),
                coupon_id: appliedCouponInfo ? appliedCouponInfo.id : null,
                grand_total: new Prisma.Decimal(grandTotal),
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
            (req.session as any).checkoutCoupon = couponSession;
            (req.session as any).cartCoupon = couponSession;
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
    } catch (error) {
        console.error("PREPARE CHECKOUT ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Không thể chuẩn bị thanh toán.",
        });
    }
};

export const applyCoupon = async (req: Request, res: Response) => {
    try {
        const identifiers = {
            cartId: readCookieCartId(req),
            tokenUser: readTokenUser(req),
        };

        const cart = await findExistingCart(identifiers);
        if (!cart) {
            return res.status(400).json({
                success: false,
                message: "Giỏ hàng trống.",
            });
        }

        const items = (cart.cart_items ?? []) as CartItemWithRelations[];
        if (!items.length) {
            return res.status(400).json({
                success: false,
                message: "Giỏ hàng trống.",
            });
        }

        let summary = buildCartData(items);

        const couponCode =
            typeof req.body?.couponCode === "string"
                ? req.body.couponCode.trim()
                : "";

        let couponRow: CouponRow | null = null;
        if (couponCode) {
            couponRow = await prisma.coupons.findFirst({
                where: {
                    code: {
                        equals: couponCode,
                        mode: "insensitive",
                    },
                    status: "ACTIVE",
                },
            });
        } else if (cart.coupon_id) {
            couponRow = (await prisma.coupons.findUnique({
                where: { couponid: Number(cart.coupon_id) },
            })) as CouponRow | null;
        }

        if (couponCode && !couponRow) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy mã giảm giá phù hợp.",
            });
        }

        let appliedCouponInfo: {
            id: number;
            code: string;
            title: string;
            type: string;
        } | null = null;

        if (couponRow) {
            const result = applyCouponToSummary(summary, couponRow);
            summary = result.summary;
            if (result.couponInfo) {
                appliedCouponInfo = result.couponInfo;
            }
        } else {
            summary = buildCartData(items);
        }

        const shippingFee = Math.max(
            0,
            Math.round(summary.totals.shipping ?? 0)
        );
        const grandTotal = Math.max(
            0,
            Math.round(summary.totals.total ?? 0)
        );

        await prisma.carts.update({
            where: { id: cart.id },
            data: {
                shipping_fee: new Prisma.Decimal(shippingFee),
                coupon_id: appliedCouponInfo ? appliedCouponInfo.id : null,
                grand_total: new Prisma.Decimal(grandTotal),
                updated_at: new Date(),
            },
        });

        if (req.session) {
            (req.session as any).cartCoupon = appliedCouponInfo
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
    } catch (error) {
        console.error("APPLY COUPON ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Không thể áp dụng mã giảm giá.",
        });
    }
};

export const clearCart = async (req: Request, res: Response) => {
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

    const cart = await findExistingCart(identifiers);
    if (!cart) {
        const emptySummary = buildCartData(
            [] as CartItemWithRelations[]
        );
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

    const txResult = await prisma.$transaction(async (tx) => {
        await tx.cart_items.deleteMany({
            where: { cart_id: cart.id },
        });

        const payload = await recalculateCart(
            tx,
            cart.id,
            identifiers.tokenUser
        );

        return {
            status: "OK" as const,
            payload,
        };
    });

    const summary = finalizeCartMutation(
        req,
        res,
        identifiers,
        txResult.payload
    );

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
};
