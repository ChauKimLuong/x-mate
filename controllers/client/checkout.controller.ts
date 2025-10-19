import { Prisma, carts } from "@prisma/client";
import { Request, Response } from "express";
import prisma from "../../config/database";

const FREE_SHIP_THRESHOLD = 500_000;
const SHIPPING_FEE = 30_000;
const CART_COOKIE_NAME = "cart_id";

type CartItemWithRelations = {
    id: number;
    product_id: string;
    variant_id: string | null;
    quantity: number | null;
    price_unit: Prisma.Decimal | number | null;
    line_subtotal: Prisma.Decimal | number | null;
    line_discount: Prisma.Decimal | number | null;
    line_total: Prisma.Decimal | number | null;
    image_url: string | null;
    size: string | null;
    color: string | null;
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

const findExistingCart = async (identifiers: { cartId?: number; tokenUser?: string }) => {
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

const buildSessionItems = (
    items: CartItemWithRelations[]
): SessionCartItem[] => {
    return items.map((item) => ({
        productId: item.product_id,
        slug: item.products?.slug ?? undefined,
        title: item.products?.title ?? "Sản phẩm",
        price: asNumber(item.price_unit),
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

const buildCartData = (items: CartItemWithRelations[]) => {
    const sessionItems = buildSessionItems(items);

    let subtotal = 0;
    let discount = 0;

    const viewItems = items.map((item) => {
        const unitPrice = asNumber(item.price_unit);
        const lineSubtotalRaw =
            item.line_subtotal !== null && item.line_subtotal !== undefined
                ? asNumber(item.line_subtotal)
                : unitPrice * (item.quantity ?? 0);
        const lineDiscountRaw =
            item.line_discount !== null && item.line_discount !== undefined
                ? asNumber(item.line_discount)
                : 0;
        const lineTotalRaw =
            item.line_total !== null && item.line_total !== undefined
                ? asNumber(item.line_total)
                : lineSubtotalRaw - lineDiscountRaw;

        subtotal += lineSubtotalRaw;
        discount += lineDiscountRaw;

        return {
            id: item.id,
            productId: item.product_id,
            variantId: item.variant_id,
            title: item.products?.title ?? "Sản phẩm",
            slug: item.products?.slug ?? "",
            quantity: item.quantity ?? 0,
            lineTotal: lineTotalRaw,
            lineTotalText: formatCurrency(lineTotalRaw),
        };
    });

    const quantity = items.reduce(
        (sum, item) => sum + (item.quantity ?? 0),
        0
    );
    const totalBeforeShipping = Math.max(0, subtotal - discount);
    const shipping =
        quantity === 0 || totalBeforeShipping >= FREE_SHIP_THRESHOLD
            ? 0
            : SHIPPING_FEE;
    const total = totalBeforeShipping + shipping;

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

const loadCartSummary = async (req: Request) => {
    const identifiers = {
        cartId: readCookieCartId(req),
        tokenUser: readTokenUser(req),
    };
    const sessionCouponRef = resolveAppliedCoupon(req);

    let cart: {
        id: number;
        cart_items: CartItemWithRelations[];
    } | null = null;

    if (identifiers.tokenUser) {
        cart = await prisma.carts.findFirst({
            where: { token_user: identifiers.tokenUser },
            include: CART_INCLUDE,
        });
    }

    if (!cart && identifiers.cartId) {
        cart = await prisma.carts.findUnique({
            where: { id: identifiers.cartId },
            include: CART_INCLUDE,
        });
    }

    if (!cart) {
        const sessionItems =
            (req.session && (req.session as any).cart) || [];
        if (Array.isArray(sessionItems) && sessionItems.length > 0) {
            const subtotal = sessionItems.reduce(
                (sum: number, item: SessionCartItem) =>
                    sum + item.price * (item.quantity ?? 0),
                0
            );
            const shipping =
                subtotal === 0 || subtotal >= FREE_SHIP_THRESHOLD
                    ? 0
                    : SHIPPING_FEE;

            return {
                items: sessionItems.map((item: SessionCartItem) => ({
                    title: item.title,
                    quantity: item.quantity,
                    lineTotal: item.price * (item.quantity ?? 0),
                    lineTotalText: formatCurrency(
                        item.price * (item.quantity ?? 0)
                    ),
                })),
                totals: {
                    quantity: sessionItems.reduce(
                        (sum: number, item: SessionCartItem) =>
                            sum + (item.quantity ?? 0),
                        0
                    ),
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

    const items = (cart.cart_items ?? []) as CartItemWithRelations[];
    let summary = buildCartData(items);

    const cartRecord = cart as CartWithRelations;

    let appliedCouponInfo: { code: string; label: string } | null = null;

    if (cartRecord.coupon_id) {
        const couponRow = (await prisma.coupons.findUnique({
            where: { couponid: cartRecord.coupon_id },
        })) as CouponRow | null;
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

    if (
        typeof cartRecord.shipping_fee !== "undefined" &&
        cartRecord.shipping_fee !== null
    ) {
        const storedShipping = asNumber(cartRecord.shipping_fee as any);
        if (Number.isFinite(storedShipping)) {
            const totals = summary.totals;
            const totalBeforeShipping = Math.max(
                0,
                totals.subtotal - totals.discount
            );
            const total = totalBeforeShipping + storedShipping;
            summary.totals = {
                ...totals,
                shipping: storedShipping,
                shippingText: formatCurrency(storedShipping),
                totalBeforeShipping,
                totalBeforeShippingText: formatCurrency(totalBeforeShipping),
                total,
                totalText: formatCurrency(total),
            };
        }
    }

    if (req.session) {
        (req.session as any).cart = summary.sessionItems;
    }

    const sessionCoupon =
        req.session && (req.session as any).checkoutCoupon
            ? (req.session as any).checkoutCoupon
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
};

const fetchAddresses = async (tokenUser?: string | undefined) => {
    if (!tokenUser) return [];
    const rows = await prisma.addresses.findMany({
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
};

const resolveAppliedCoupon = (req: Request) => {
    const sessionCoupon = req.session
        ? ((req.session as any).checkoutCoupon ??
              (req.session as any).appliedCoupon ??
              (req.session as any).cartCoupon ??
              null)
        : null;

    if (sessionCoupon && typeof sessionCoupon === "object") {
        const code =
            typeof sessionCoupon.code === "string"
                ? sessionCoupon.code
                : undefined;
        const label =
            typeof sessionCoupon.label === "string"
                ? sessionCoupon.label
                : undefined;
        const type =
            typeof sessionCoupon.type === "string"
                ? sessionCoupon.type
                : undefined;
        if (code) {
            return {
                code,
                label: label ?? undefined,
                type: type ?? undefined,
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

export const index = async (req: Request, res: Response) => {
    try {
        const [cartSummary, addresses] = await Promise.all([
            loadCartSummary(req),
            fetchAddresses(readTokenUser(req)),
        ]);

        const appliedCoupon =
            cartSummary.coupon ?? resolveAppliedCoupon(req);

        const defaultAddress =
            addresses && addresses.length
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
    } catch (error) {
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
};

export const checkoutPost = async (req: Request, res: Response) => {
    const identifiers = {
        cartId: readCookieCartId(req),
        tokenUser: readTokenUser(req),
    };
    const redirectTo = req.get("referer") || "/checkout";

    const {
        fullName,
        phone,
        line1,
        city,
        district,
        ward,
        note,
        paymentMethod,
    } = req.body || {};

    if (
        typeof fullName !== "string" ||
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
        paymentMethod.trim() === ""
    ) {
        req.flash(
            "error",
            "Vui lòng điền đầy đủ thông tin!"
        );
        return res.redirect(redirectTo);
    }

    const cart = await findExistingCart(identifiers);
    if (!cart) {
        req.flash("error", "Giỏ hàng trống.");
        return res.redirect(redirectTo);
    }

    const items = (cart.cart_items ?? []) as CartItemWithRelations[];
    if (!items.length) {
        req.flash("error", "Giỏ hàng trống.");
        return res.redirect(redirectTo);
    }

    let summary = buildCartData(items);

    let couponRow: CouponRow | null = null;
    if (cart.coupon_id) {
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

    const orderItemsData = items.map((item) => {
        const unitPrice = asNumber(item.price_unit);
        const quantity = item.quantity ?? 0;
        const lineTotal =
            item.line_total !== null && item.line_total !== undefined
                ? asNumber(item.line_total)
                : unitPrice * quantity;

        return {
            product_id: item.product_id,
            variant_id: item.variant_id,
            product_slug: item.products?.slug || item.product_id,
            thumbnail_snapshot:
                item.image_url ||
                item.productVariants?.images?.[0] ||
                item.products?.thumbnail ||
                null,
            price: new Prisma.Decimal(unitPrice),
            quantity,
            size: item.size ?? null,
            color: item.color ?? null,
            line_total: new Prisma.Decimal(lineTotal),
        };
    });

    try {
        const order = await prisma.$transaction(async (tx) => {
            const createdOrder = await tx.orders.create({
                data: {
                    token_user: identifiers.tokenUser ?? null,
                    status: "pending",
                    payment_method: paymentMethod,
                    coupon_id: appliedCouponInfo ? appliedCouponInfo.id : null,
                    subtotal: new Prisma.Decimal(summary.totals.subtotal),
                    discount_total: new Prisma.Decimal(summary.totals.discount),
                    shipping_fee: new Prisma.Decimal(summary.totals.shipping),
                    grand_total: new Prisma.Decimal(summary.totals.total),
                    shipping_full_name: fullName.trim(),
                    shipping_phone: phone.trim(),
                    shipping_line1: line1.trim(),
                    shipping_city: city.trim(),
                    shipping_district: district.trim(),
                    shipping_ward: ward.trim(),
                    note:
                        typeof note === "string" && note.trim() !== ""
                            ? note.trim()
                            : null,
                    order_items: {
                        create: orderItemsData,
                    },
                },
            });

            await tx.cart_items.deleteMany({
                where: { cart_id: cart.id },
            });

            await tx.carts.update({
                where: { id: cart.id },
                data: {
                    grand_total: new Prisma.Decimal(0),
                    shipping_fee: new Prisma.Decimal(0),
                    coupon_id: null,
                    updated_at: new Date(),
                },
            });

            return createdOrder;
        });

        if (req.session) {
            (req.session as any).cart = [];
            (req.session as any).cartCoupon = null;
            (req.session as any).checkoutCoupon = null;
        }

        req.flash(
            "success",
            `Đặt hàng thành công!`
        );
        return res.redirect("/");
    } catch (error) {
        console.error("CHECKOUT SUBMIT ERROR:", error);
        req.flash("error", "Không thể tạo đơn hàng.");
        return res.redirect(redirectTo);
    }
};
