//@ts-nocheck
import { Request, Response } from "express";
import prisma from "../../config/database";
import { buildPrimaryNav } from "../../utils/category-nav";

const DEFAULT_SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];
const toNumber = (v: unknown) => (isNaN(Number(v)) ? null : Number(v));
const formatCurrency = (a: number) =>
    new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
    }).format(Math.max(0, Math.round(a)));

/** Lấy tất cả id danh mục con (đệ quy) */
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

/** Chuẩn hoá dữ liệu cho product-card (giống Home) */
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
        colors: [], // nếu cần palette màu thì tái sử dụng hàm buildColorPalette trước đó
    };
};

/** [GET] /category/:slug */
export const detail = async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;

        // 1) Lấy thông tin danh mục hiện tại + dữ liệu cho nav
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

        // 2) Lấy danh mục con TRỰC TIẾP để hiển thị grid phía trên (cần thumbnail)
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

        // 3) Lấy toàn bộ id con/cháu/chắt để gom sản phẩm
        const descendantIds = await getAllDescendantIds(parent.id);
        const categoryIds = [parent.id, ...descendantIds];

        // 4) Lấy sản phẩm thuộc TẤT CẢ danh mục ở trên
        const products = await prisma.products.findMany({
            where: { categoryId: { in: categoryIds }, deleted: false },
            include: { productVariants: true },
            orderBy: [{ createdAt: "desc" }],
        });

        const viewProducts = products.map(buildProductCardData);
        const primaryCategories = buildPrimaryNav(allCategories);

        res.locals.primaryCategories = primaryCategories;

        return res.render("client/pages/category/index", {
            parent,
            children: childCategories, // ✅ có thumbnail để hiển thị ảnh
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
