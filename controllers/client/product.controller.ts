import { Request, Response } from "express";
import prisma from "../../config/database";

const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "bigint") return Number(value);
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value === "object" && value !== null) {
        const valueWithToString = value as { toString?: () => string };
        if (typeof valueWithToString.toString === "function") {
            const parsed = Number(valueWithToString.toString());
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

const buildColorPalette = (product: any) => {
    const colorMap = new Map<
        string,
        {
            name: string;
            hex: string | null;
            swatchUrl: string | null;
            image: string | null;
        }
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
        if (
            hexCandidate &&
            /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hexCandidate)
        ) {
            hex = hexCandidate;
        } else if (
            name.startsWith("#") &&
            /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(name)
        ) {
            hex = name;
        }
        const swatchUrl = hex ? "" : swatchCandidate;
        const key = (name || hex || swatchUrl || "default").toLowerCase();
        const existing = colorMap.get(key);
        if (existing) {
            if (!existing.name && name) existing.name = name;
            if (!existing.hex && hex) existing.hex = hex;
            if (!existing.swatchUrl && swatchUrl)
                existing.swatchUrl = swatchUrl;
            if (!existing.image && imageCandidate)
                existing.image = imageCandidate;
            return;
        }
        colorMap.set(key, {
            name: name || "Mau khac",
            hex: hex || null,
            swatchUrl: swatchUrl || null,
            image: imageCandidate || null,
        });
    };

    const prismaVariants = Array.isArray(product?.productVariants)
        ? product.productVariants
        : [];
    prismaVariants.forEach((variant: any) => {
        const variantColor = (variant as any)?.colors ?? null;
        recordColor(
            (variant as any)?.color ?? variantColor?.name ?? null,
            (variant as any)?.colorHexLegacy ?? variantColor?.hex ?? null,
            variantColor?.swatchUrl ??
                (variant as any)?.swatchUrlLegacy ??
                null,
            Array.isArray(variant?.images) && variant.images.length
                ? variant.images[0]
                : null
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
            Array.isArray(variant?.images) && variant.images.length
                ? variant.images[0]
                : null
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
            ("name" in colorValue ||
                "hex" in colorValue ||
                "swatchUrl" in colorValue)
        ) {
            recordColor(
                (colorValue as any).name ?? null,
                (colorValue as any).hex ?? null,
                (colorValue as any).swatchUrl ?? null,
                (colorValue as any).image ?? null
            );
        }
    });

    return Array.from(colorMap.values()).slice(0, 8);
};

// [GET] /product/detail/:slug
export const detail = async (req: Request, res: Response) => {
    try {
        const rawSlug = typeof req.params?.slug === "string" ? req.params.slug : "";
        const slug = rawSlug.trim();
        if (!slug) {
            return res
                .status(404)
                .render("client/pages/product/detail", { product: null });
        }
        console.log(slug);

        const product = await prisma.products.findFirst({
            where: {
                deleted: false,
                slug: {
                    equals: slug,
                    mode: "insensitive",
                },
            },
            include: {
                productVariants: {
                    include: {
                        colors: true,
                    },
                },
                categories: true,
            },
        });
        console.log(product);

        if (!product) {
            console.warn("[PRODUCT DETAIL] Not found slug:", slug);
            return res
                .status(404)
                .render("client/pages/product/detail", { product: null });
        }

        const prismaVariants = Array.isArray(product.productVariants)
            ? product.productVariants
            : [];

        const variantImages = prismaVariants.flatMap((variant) =>
            Array.isArray(variant.images) ? variant.images : []
        );
        const baseImages = Array.isArray((product as any)?.images)
            ? ((product as any)?.images as string[])
            : [];
        const images = [
            product.thumbnail,
            ...variantImages,
            ...baseImages,
        ].filter((img): img is string => Boolean(img));

        const rawPrice = toNumber(product.price) ?? 0;
        const discountPercent = Math.max(0, toNumber(product.discount) ?? 0);
        const priceAfterDiscount =
            discountPercent > 0
                ? Math.max(
                      0,
                      Math.round((rawPrice * (100 - discountPercent)) / 100)
                  )
                : rawPrice;

        const colors = buildColorPalette(product);

        const sizeFromProduct = Array.isArray(product.size) ? product.size : [];
        const legacySizes = Array.isArray((product as any)?.sizes)
            ? ((product as any)?.sizes as string[])
            : [];
        const sizes = Array.from(
            new Set(
                [...sizeFromProduct, ...legacySizes]
                    .filter(
                        (size) => typeof size === "string" && size.trim() !== ""
                    )
                    .map((size) => size.trim())
            )
        );
        const resolvedSizes = sizes.length ? sizes : ["Free Size"];

        const shareUrl = `${req.protocol}://${req.get("host")}${
            req.originalUrl
        }`;
        const totalStock = prismaVariants.reduce(
            (sum, variant) => sum + (toNumber((variant as any)?.stock) ?? 0),
            0
        );

        const viewModel = {
            id: product.id,
            slug: product.slug,
            title: product.title,
            description: product.description,
            category: product.categories?.title ?? null,
            categorySlug: product.categories?.slug ?? null,
            priceText: formatCurrency(rawPrice),
            finalPriceText: formatCurrency(priceAfterDiscount),
            discountPercent,
            hasDiscount: discountPercent > 0,
            thumbnail: product.thumbnail,
            images,
            colors,
            defaultColor: colors[0] ?? null,
            sizes: resolvedSizes,
            defaultSize: resolvedSizes[0] ?? null,
            stock: totalStock,
            shareUrl,
            vouchers: [],
            freeShip: priceAfterDiscount >= 500_000,
            priceForCart: priceAfterDiscount,
        };

        res.render("client/pages/product/detail", { product: viewModel });
    } catch (error) {
        console.error("PRODUCT DETAIL ERROR", error);
        res.status(500).render("client/pages/product/detail", {
            product: null,
        });
    }
};
