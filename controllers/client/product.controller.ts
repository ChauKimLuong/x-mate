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
    const palette = new Map<string, { name: string; hex: string }>();

    const register = (nameRaw?: string | null, hexRaw?: string | null) => {
        const name = nameRaw?.trim() ?? "";
        const hexCandidate = hexRaw?.trim() ?? "";
        let hex = "";
        if (hexCandidate && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hexCandidate)) {
            hex = hexCandidate;
        } else if (
            name.startsWith("#") &&
            /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(name)
        ) {
            hex = name;
        }
        const key = (name || hex || "default").toLowerCase();
        if (!palette.has(key)) {
            palette.set(key, {
                name: name || "Màu khác",
                hex: hex || "#1f2937",
            });
        }
    };

    const prismaVariants = Array.isArray(product?.productVariants)
        ? product.productVariants
        : [];
    prismaVariants.forEach((variant: any) => {
        register(variant?.color ?? null, variant?.colorHexLegacy ?? null);
    });

    const legacyVariants = Array.isArray(product?.variants)
        ? product.variants
        : [];
    legacyVariants.forEach((variant: any) => {
        register(
            variant?.color ?? null,
            variant?.colorHexLegacy ?? variant?.colorHex ?? null
        );
    });

    const colorField = Array.isArray(product?.colors) ? product.colors : [];
    colorField.forEach((colorName: string) => register(colorName ?? "", null));

    return Array.from(palette.values()).slice(0, 8);
};

// [GET] /product/detail/:slug
export const detail = async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;
        const product = await prisma.products.findFirst({
            where: { slug, deleted: false },
            include: { productVariants: true, categories: true },
        });

        if (!product) {
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
                ? Math.max(0, Math.round(rawPrice * (100 - discountPercent) / 100))
                : rawPrice;

        const colors = buildColorPalette(product);

        const sizeFromProduct = Array.isArray(product.size) ? product.size : [];
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
        const resolvedSizes = sizes.length ? sizes : ["Free Size"];

        const shareUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
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
        res
            .status(500)
            .render("client/pages/product/detail", { product: null });
    }
};