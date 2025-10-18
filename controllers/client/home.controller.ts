//@ts-nocheck
import { Request, Response } from "express";
import prisma from "../../config/database";
import { buildPrimaryNav } from "../../utils/category-nav";

const DEFAULT_SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];

const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "bigint") {
        return Number(value);
    }
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value === "object" && value !== null) {
        const stringified =
            typeof (value as { toString?: () => string }).toString === "function"
                ? (value as { toString: () => string }).toString()
                : "";
        if (stringified) {
            const parsed = Number(stringified);
            return Number.isFinite(parsed) ? parsed : null;
        }
    }
    return null;
};

const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
    }).format(Math.max(0, Math.round(amount)));
};

type RawProduct = Awaited<ReturnType<typeof prisma.products.findMany>>[number];

const buildProductCardData = (
    product: RawProduct & { variants?: any[]; images?: string[]; colors?: string[] }
) => {
    const productId = product?.id ?? "";
    const productSlug = product?.slug ?? "";
    const productTitle = product?.title ?? "Sản phẩm";

    const prismaVariants = Array.isArray(product.productVariants)
        ? product.productVariants
        : [];
    const legacyVariants = Array.isArray((product as any)?.variants)
        ? (product as any).variants
        : [];

    const legacyVariantImages = legacyVariants.flatMap((variant: any) =>
        Array.isArray(variant?.images) ? variant.images : []
    );
    const prismaVariantImages = prismaVariants.flatMap((variant: any) =>
        Array.isArray(variant?.images) ? variant.images : []
    );
    const baseImages = Array.isArray((product as any)?.images)
        ? ((product as any)?.images as string[])
        : [];

    const allImages = [
        product?.thumbnail,
        ...prismaVariantImages,
        ...legacyVariantImages,
        ...baseImages,
    ].filter((img): img is string => Boolean(img));

    const thumbnail = allImages[0] ?? "/images/placeholder.jpg";
    const hoverThumbnail =
        allImages.find((img) => img && img !== thumbnail) ?? thumbnail;

    const sizeFromProduct = Array.isArray(product?.size) ? product.size : [];
    const legacySizes = Array.isArray((product as any)?.sizes)
        ? ((product as any)?.sizes as string[])
        : [];
    const sizes = Array.from(
        new Set(
            [...sizeFromProduct, ...legacySizes]
                .filter((size) => typeof size === "string" && size.trim() !== "")
                .map((size) => size.trim())
        )
    );
    const resolvedSizes = sizes.length ? sizes : DEFAULT_SIZES;

    const colorMap = new Map<string, { name: string; hex: string }>();
    const recordColor = (nameRaw?: string | null, hexRaw?: string | null) => {
        const name = nameRaw?.trim() ?? "";
        const hexCandidate = hexRaw?.trim() ?? "";
        let hex = "";
        if (hexCandidate && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hexCandidate)) {
            hex = hexCandidate;
        } else if (name.startsWith("#") && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(name)) {
            hex = name;
        }
        const key = (name || hex || "default").toLowerCase();
        if (!colorMap.has(key)) {
            colorMap.set(key, {
                name: name || "Màu khác",
                hex: hex || "#1f2937",
            });
        }
    };

    prismaVariants.forEach((variant: any) => {
        recordColor(
            (variant as any)?.color ?? null,
            (variant as any)?.colorHexLegacy ?? null
        );
    });
    legacyVariants.forEach((variant: any) => {
        recordColor(
            variant?.color ?? null,
            variant?.colorHexLegacy ?? variant?.colorHex ?? null
        );
    });

    const colors = Array.from(colorMap.values()).slice(0, 5);

    const rawPrice = toNumber(product?.price) ?? 0;
    const discountRaw = toNumber(product?.discount) ?? 0;
    const discountPercent = discountRaw > 0 ? discountRaw : 0;
    const priceAfterDiscount =
        discountPercent > 0
            ? Math.max(0, Math.round(rawPrice * (100 - discountPercent) / 100))
            : rawPrice;

    const finalPriceText = formatCurrency(priceAfterDiscount);
    const originalPriceText =
        discountPercent > 0 ? formatCurrency(rawPrice) : null;

    return {
        id: productId,
        slug: productSlug,
        title: productTitle,
        thumbnail,
        hoverThumbnail,
        images: allImages,
        sizes: resolvedSizes,
        colors,
        finalPriceText,
        originalPriceText,
        hasDiscount: discountPercent > 0,
        discountPercent,
        priceForCart: priceAfterDiscount,
    };
};

export const index = async (req: Request, res: Response) => {
    try {
        const [products, categories] = await Promise.all([
            prisma.products.findMany({
                include: {
                    productVariants: true,
                    categories: true,
                },
            }),
            prisma.categories.findMany({
                where: { status: "active" },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    parentId: true,
                },
            }),
        ]);

        const viewProducts = products.map((product) =>
            buildProductCardData(product as any)
        );

        const primaryCategories = buildPrimaryNav(categories);

        res.locals.searchQuery = "";
        res.locals.primaryCategories = primaryCategories;

        res.render("client/pages/home/index", {
            products: viewProducts,
            isSearch: false,
            searchQuery: "",
            searchTotal: viewProducts.length,
            primaryCategories,
        });
    } catch (error) {
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
};

export const search = async (req: Request, res: Response) => {
    const rawQuery = typeof req.query?.q === "string" ? req.query.q : "";
    const query = rawQuery.trim();

    if (!query) {
        return res.redirect("/");
    }

    try {
        const [products, categories] = await Promise.all([
            prisma.products.findMany({
                where: {
                    deleted: false,
                    title: {
                        contains: query,
                        mode: "insensitive",
                    },
                },
                include: {
                    productVariants: true,
                    categories: true,
                },
            }),
            prisma.categories.findMany({
                where: { status: "active" },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    parentId: true,
                },
            }),
        ]);

        const viewProducts = products.map((product) =>
            buildProductCardData(product as any)
        );

        const primaryCategories = buildPrimaryNav(categories);

        res.locals.searchQuery = query;
        res.locals.primaryCategories = primaryCategories;

        res.render("client/pages/home/index", {
            products: viewProducts,
            isSearch: true,
            searchQuery: query,
            searchTotal: viewProducts.length,
            primaryCategories,
        });
    } catch (error) {
        console.error("SEARCH ERROR:", error);
        res.locals.searchQuery = query;
        const fallbackCategories = Array.isArray(res.locals.primaryCategories)
            ? res.locals.primaryCategories
            : [];
        res.status(500).render("client/pages/home/index", {
            products: [],
            isSearch: true,
            searchQuery: query,
            searchTotal: 0,
            error: "Không thể tìm kiếm sản phẩm lúc này.",
            primaryCategories: fallbackCategories,
        });
    }
};


export const sale = async (req: Request, res: Response) => {
    try {
        const [products, categories] = await Promise.all([
            prisma.products.findMany({
                where: {
                    deleted: false,
                    discount: {
                        gte: 50,
                    },
                },
                include: {
                    productVariants: true,
                    categories: true,
                },
                orderBy: {
                    discount: "desc",
                },
            }),
            prisma.categories.findMany({
                where: { status: { equals: "active"} },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    parentId: true,
                    description: true,
                },
            }),
        ]);

        const viewProducts = products.map((product) => buildProductCardData(product as any));
        const primaryCategories = buildPrimaryNav(categories);

        res.locals.primaryCategories = primaryCategories;
        res.locals.searchQuery = "";

        res.render("client/pages/home/index", {
            products: viewProducts,
            isSearch: false,
            searchQuery: "",
            searchTotal: viewProducts.length,
            primaryCategories,
            summaryHeading: "Ưu đãi sốc",
            summaryHighlight: "Giảm từ 50%",
            summaryMeta: `${viewProducts.length} sản phẩm`,
        });
    } catch (error) {
        console.error("SALE PAGE ERROR:", error);
        const fallbackCategories = Array.isArray(res.locals.primaryCategories)
            ? res.locals.primaryCategories
            : [];
        res.status(500).render("client/pages/home/index", {
            products: [],
            isSearch: false,
            searchQuery: "",
            searchTotal: 0,
            error: "Không thể tải danh sách ưu đãi.",
            primaryCategories: fallbackCategories,
            summaryHeading: "Ưu đãi sốc",
            summaryHighlight: "Giảm từ 50%",
            summaryMeta: "0 sản phẩm",
        });
    }
};

export const theThao = async (req: Request, res: Response) => {
    try {
        const [products, categories] = await Promise.all([
            prisma.products.findMany({
                where: {
                    deleted: false,
                    OR: [
                        {
                            slug: {
                                contains: "the-thao",
                                mode: "insensitive",
                            },
                        },
                        {
                            categories: {
                                is: {
                                    slug: {
                                        contains: "the-thao",
                                        mode: "insensitive",
                                    },
                                },
                            },
                        },
                    ],
                },
                include: {
                    productVariants: true,
                    categories: true,
                },
                orderBy: {
                    updatedAt: "desc",
                },
            }),
            prisma.categories.findMany({
                where: { status: { equals: "active" } },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    parentId: true,
                    description: true,
                },
            }),
        ]);

        const viewProducts = products.map((product) => buildProductCardData(product as any));
        const primaryCategories = buildPrimaryNav(categories);

        res.locals.primaryCategories = primaryCategories;
        res.locals.searchQuery = "";

        res.render("client/pages/home/index", {
            products: viewProducts,
            isSearch: false,
            searchQuery: "",
            searchTotal: viewProducts.length,
            primaryCategories,
            summaryHeading: "Bộ sưu tập thể thao",
            summaryHighlight: "Phong cách năng động",
            summaryMeta: `${viewProducts.length} sản phẩm`,
        });
    } catch (error) {
        console.error("SPORT PAGE ERROR:", error);
        const fallbackCategories = Array.isArray(res.locals.primaryCategories)
            ? res.locals.primaryCategories
            : [];
        res.status(500).render("client/pages/home/index", {
            products: [],
            isSearch: false,
            searchQuery: "",
            searchTotal: 0,
            error: "Không thể tải danh mục thể thao.",
            primaryCategories: fallbackCategories,
            summaryHeading: "Bộ sưu tập thể thao",
            summaryHighlight: "Phong cách năng động",
            summaryMeta: "0 sản phẩm",
        });
    }
};
