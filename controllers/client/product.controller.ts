import { Request, Response } from "express";
import prisma from "../../config/database";

function formatVnd(value?: number | null) {
    if (typeof value !== "number" || Number.isNaN(value)) return null;
    return value.toLocaleString("vi-VN") + "đ";
}

// [GET] /product/detail/:slug
export const detail = async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;
        const product = await prisma.products.findFirst({
            where: { slug, deleted: false },
            include: { productVariants: true, categories: true },
        });

        if (!product) {
            return res.status(404).render("client/pages/product/detail", { product: null });
        }

        const prismaVariants = product.productVariants ?? [];
        const baseImages = Array.isArray((product as any).images) ? (product as any).images : [];
        const allImages = [
            product.thumbnail,
            ...prismaVariants.flatMap((variant) => variant.images || []),
            ...baseImages,
        ].filter(Boolean);

        const rawPrice = typeof product.price === 'number' ? product.price : 0;
        const discountValue = typeof product.discount === 'number' ? product.discount : 0;
        const finalPrice = Math.round(rawPrice * (100 - discountValue) / 100);

        const colors = Array.from(new Set([
            ...prismaVariants.map((variant) => variant.color).filter(Boolean),
            ...((product as any).colors || []),
        ])).slice(0, 5);

        const sizes = product.size ?? [];

        const viewModel = {
            id: product.id,
            title: product.title,
            description: product.description,
            category: product.categories?.title,
            priceText: formatVnd(rawPrice),
            finalPriceText: formatVnd(finalPrice),
            discount: discountValue,
            thumbnail: product.thumbnail,
            allImages,
            colors,
            selectedColor: colors[0] ?? null,
            sizes,
            selectedSize: sizes[0] ?? null,
            vouchers: ["Giảm 50K"],
            freeShip: true,
        };

        res.render("client/pages/product/detail", { product: viewModel });
    } catch (error) {
        console.error("PRODUCT DETAIL ERROR", error);
        res.status(500).render("client/pages/product/detail", { product: null });
    }
};