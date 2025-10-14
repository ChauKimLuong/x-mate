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
      include: {
        categories: { select: { title: true, slug: true } },
        productVariants: {
          select: {
            images: true,
            color: true,
            colorId: true,
            colorHexLegacy: true,
            swatchUrlLegacy: true,
            colors: { select: { id: true, name: true, hex: true, swatchUrl: true } }, // <-- quan trọng
          },
        },
      },
    });

    if (!product) {
      return res
        .status(404)
        .render("client/pages/product/detail", { product: null });
    }

    // ==== Gallery (thumbnail + ảnh variants + ảnh base nếu có field images cũ) ====
    const prismaVariants = product.productVariants ?? [];
    const baseImages = Array.isArray((product as any).images)
      ? (product as any).images
      : [];
    const allImages = [
      product.thumbnail,
      ...prismaVariants.flatMap((v) => v.images || []),
      ...baseImages,
    ].filter(Boolean);

    // ==== Giá ====
    const rawPrice = typeof product.price === "number" ? product.price : 0;
    const discountValue =
      typeof product.discount === "number" ? product.discount : 0;
    const finalPrice = Math.round((rawPrice * (100 - discountValue)) / 100);

    // ==== Swatches (ưu tiên bảng colors, fallback legacy) ====
    type Swatch = {
      label: string;
      hex?: string | null;
      img?: string | null;
      colorId?: string | null;
    };
    const swatchMap = new Map<string, Swatch>();
    for (const v of prismaVariants) {
      const label = (v.colors?.name || v.color || "").trim();
      if (!label) continue;
      const hex = v.colors?.hex || v.colorHexLegacy || null;
      const img = v.colors?.swatchUrl || v.swatchUrlLegacy || null;
      const colorId = v.colorId || null;
      if (!swatchMap.has(label)) swatchMap.set(label, { label, hex, img, colorId });
    }
    const swatches = Array.from(swatchMap.values()); // [{label, hex, img, colorId}]

    // Mảng màu dạng text nếu view vẫn dùng product.colors
    const colors = swatches.map((s) => s.label);

    // ==== Sizes ====
    const sizes = Array.isArray(product.size) ? product.size : [];

    // ==== View model ====
    const viewModel = {
      id: product.id,
      slug: product.slug,
      title: product.title,
      description: product.description,
      category: product.categories?.title,
      categorySlug: product.categories?.slug,
      priceText: formatVnd(rawPrice),
      finalPriceText: formatVnd(finalPrice),
      discount: discountValue,
      thumbnail: product.thumbnail,
      allImages,
      // màu
      swatches,                 // dùng để render badge màu (hex/img/label)
      colors,                   // nếu cần text
      selectedColor: colors[0] ?? null,
      // size
      sizes,
      selectedSize: sizes[0] ?? null,
      // extras
      vouchers: ["Giảm 50K"],
      freeShip: true,
      productVariants: prismaVariants, // phòng khi view cần
    };

    res.render("client/pages/product/detail", { product: viewModel });
  } catch (error) {
    console.error("PRODUCT DETAIL ERROR", error);
    res.status(500).render("client/pages/product/detail", { product: null });
  }
};
