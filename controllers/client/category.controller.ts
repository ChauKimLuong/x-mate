//@ts-nocheck
import { Request, Response } from "express";
import prisma from "../../config/database";
import { buildPrimaryNav } from "../../utils/category-nav";

const DEFAULT_SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];
const toNumber = (v: unknown) => (isNaN(Number(v)) ? null : Number(v));
const buildColorPalette = (product: any) => {
    const colorMap = new Map<
        string,
        { name: string; hex: string | null; swatchUrl: string | null; image: string | null }
    >();
    const recordColor = (
        nameRaw?: string | null,
        hexRaw?: string | null,
        swatchRaw?: string | null,
        imageRaw?: string | null
    ) => {
        const name = nameRaw?.trim() ?? "";
        const hexCandidate = typeof hexRaw === "string" ? hexRaw.trim() : "";
        const swatchCandidate =
            typeof swatchRaw === "string" ? swatchRaw.trim() : "";
        const imageCandidate =
            typeof imageRaw === "string" ? imageRaw.trim() : "";
        let hex = "";
        if (hexCandidate && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hexCandidate)) {
            hex = hexCandidate;
        } else if (name.startsWith("#") && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(name)) {
            hex = name;
        }
        const swatchUrl = hex ? "" : swatchCandidate;
        const key = (name || hex || swatchUrl || "default").toLowerCase();
        const existing = colorMap.get(key);
        if (existing) {
            if (!existing.name && name) existing.name = name;
            if (!existing.hex && hex) existing.hex = hex;
            if (!existing.swatchUrl && swatchUrl) existing.swatchUrl = swatchUrl;
            if (!existing.image && imageCandidate) existing.image = imageCandidate;
            return;
        }
        colorMap.set(key, {
            name: name || "Mau khac",
            hex: hex || null,
            swatchUrl: swatchUrl || null,
            image: imageCandidate || null,
        });
    };

    // Collect colors from Prisma variants if present
    const prismaVariants = Array.isArray(product?.productVariants)
        ? (product.productVariants as any[])
        : [];
    prismaVariants.forEach((variant: any) => {
        const variantColor = (variant as any)?.colors ?? null;
        recordColor(
            (variant as any)?.color ?? variantColor?.name ?? null,
            (variant as any)?.colorHexLegacy ?? variantColor?.hex ?? null,
            variantColor?.swatchUrl ?? (variant as any)?.swatchUrlLegacy ?? null,
            Array.isArray(variant?.images) && variant.images.length ? variant.images[0] : null
        );
    });
    const legacyVariants = Array.isArray((product as any)?.variants)
        ? ((product as any)?.variants as any[])
        : [];
    legacyVariants.forEach((variant: any) => {
        recordColor(
            variant?.color ?? null,
            variant?.colorHexLegacy ?? variant?.colorHex ?? null,
            (variant as any)?.swatchUrlLegacy ?? null,
            Array.isArray(variant?.images) && variant.images.length ? variant.images[0] : null
        );
    });

    const colorField = Array.isArray(product?.colors) ? product.colors : [];
    colorField.forEach((colorValue: any) => {
        if (typeof colorValue === "string") {
            const trimmed = colorValue.trim();
            if (!trimmed) {
                return;
            }
            if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
                recordColor("", trimmed, null, null);
            } else if (/^https?:\/\//i.test(trimmed)) {
                recordColor("", null, trimmed, null);
            } else {
                recordColor(trimmed, null, null, null);
            }
        } else if (
            colorValue &&
            typeof colorValue === "object" &&
            ("name" in colorValue || "hex" in colorValue || "swatchUrl" in colorValue)
        ) {
            recordColor(
                (colorValue as any).name ?? null,
                (colorValue as any).hex ?? null,
                (colorValue as any).swatchUrl ?? null,
                (colorValue as any).image ?? null
            );
        }
    });

    return Array.from(colorMap.values()).slice(0, 5);
};

const formatCurrency = (a: number) =>
    new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
    }).format(Math.max(0, Math.round(a)));

/** Láº¥y táº¥t cáº£ id danh má»¥c con (Ä‘á»‡ quy) */
const getAllDescendantIds = async (parentId: string): Promise<string[]> => {
    const children = await prisma.categories.findMany({
        where: { parentId, deleted: false },
        select: { id: true },
    });
    if (!children.length) return [];
    const childIds = children.map((c) => c.id);
    const grandChildIds = (
        await Promise.all(childIds.map((id) => getAllDescendantIds(id)))
    ).flat();
    return [...childIds, ...grandChildIds];
};

/** Chuáº©n hoÃ¡ dá»¯ liá»‡u cho product-card (giá»‘ng Home) */
const buildProductCardData = (product: any) => {
    const rawPrice = toNumber(product.price) ?? 0;
    const discount = toNumber(product.discount) ?? 0;
    const priceAfter = discount
        ? Math.round((rawPrice * (100 - discount)) / 100)
        : rawPrice;

    const imgs = [
        product.thumbnail,
        ...(product.productVariants?.flatMap((v: any) => v.images || []) ?? []),
        ...(Array.isArray(product.images) ? product.images : []),
    ].filter(Boolean);

    return {
        id: product.id,
        slug: product.slug,
        title: product.title,
        thumbnail: imgs[0] || "/images/placeholder.jpg",
        hoverThumbnail: imgs[1] || imgs[0],
        finalPriceText: formatCurrency(priceAfter),
        originalPriceText: discount ? formatCurrency(rawPrice) : null,
        hasDiscount: discount > 0,
        discountPercent: discount,
        priceForCart: priceAfter,
        sizes:
            Array.isArray(product.size) && product.size.length
                ? product.size
                : DEFAULT_SIZES,
        colors: buildColorPalette(product),
    };
};

/** [GET] /category/:slug */
export const detail = async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;

        // 1) Láº¥y thÃ´ng tin danh má»¥c hiá»‡n táº¡i + dá»¯ liá»‡u cho nav
        const [parent, allCategories] = await Promise.all([
            prisma.categories.findFirst({
                where: { slug, deleted: false },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    description: true,
                    thumbnail: true,
                },
            }),
            prisma.categories.findMany({
                where: { status: "active" },
                select: { id: true, title: true, slug: true, parentId: true },
            }),
        ]);

        if (!parent) {
            return res.status(404).render("client/pages/category/index", {
                parent: null,
                children: [],
                products: [],
                primaryCategories: [],
            });
        }

        // 2) Láº¥y danh má»¥c con TRá»°C TIáº¾P Ä‘á»ƒ hiá»ƒn thá»‹ grid phÃ­a trÃªn (cáº§n thumbnail)
        const childCategories = await prisma.categories.findMany({
            where: { parentId: parent.id, deleted: false },
            orderBy: [{ position: "asc" }, { title: "asc" }],
            select: {
                id: true,
                title: true,
                slug: true,
                thumbnail: true,
                description: true,
            },
        });

        // 3) Láº¥y toÃ n bá»™ id con/chÃ¡u/cháº¯t Ä‘á»ƒ gom sáº£n pháº©m
        const descendantIds = await getAllDescendantIds(parent.id);
        const categoryIds = [parent.id, ...descendantIds];

        // 4) Láº¥y sáº£n pháº©m thuá»™c Táº¤T Cáº¢ danh má»¥c á»Ÿ trÃªn
        const products = await prisma.products.findMany({
            where: { categoryId: { in: categoryIds }, deleted: false },
            include: {
                productVariants: {
                    include: {
                        colors: true,
                    },
                },
            },
            orderBy: [{ createdAt: "desc" }],
        });

        const viewProducts = products.map(buildProductCardData);
        const primaryCategories = buildPrimaryNav(allCategories);

        res.locals.primaryCategories = primaryCategories;

        return res.render("client/pages/category/index", {
            parent,
            children: childCategories, // âœ… cÃ³ thumbnail Ä‘á»ƒ hiá»ƒn thá»‹ áº£nh
            products: viewProducts,
            primaryCategories,
        });
    } catch (err) {
        console.error("CATEGORY DETAIL ERROR:", err);
        res.status(500).render("client/pages/category/index", {
            parent: null,
            children: [],
            products: [],
            primaryCategories: [],
        });
    }
};
