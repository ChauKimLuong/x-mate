"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detail = void 0;
const database_1 = __importDefault(require("../../config/database"));
function formatVnd(value) {
    if (typeof value !== "number" || Number.isNaN(value))
        return null;
    return value.toLocaleString("vi-VN") + "đ";
}
const detail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
        const { slug } = req.params;
        const product = yield database_1.default.products.findFirst({
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
                        colors: { select: { id: true, name: true, hex: true, swatchUrl: true } },
                    },
                },
            },
        });
        if (!product) {
            return res
                .status(404)
                .render("client/pages/product/detail", { product: null });
        }
        const prismaVariants = (_a = product.productVariants) !== null && _a !== void 0 ? _a : [];
        const baseImages = Array.isArray(product.images)
            ? product.images
            : [];
        const allImages = [
            product.thumbnail,
            ...prismaVariants.flatMap((v) => v.images || []),
            ...baseImages,
        ].filter(Boolean);
        const rawPrice = typeof product.price === "number" ? product.price : 0;
        const discountValue = typeof product.discount === "number" ? product.discount : 0;
        const finalPrice = Math.round((rawPrice * (100 - discountValue)) / 100);
        const swatchMap = new Map();
        for (const v of prismaVariants) {
            const label = (((_b = v.colors) === null || _b === void 0 ? void 0 : _b.name) || v.color || "").trim();
            if (!label)
                continue;
            const hex = ((_c = v.colors) === null || _c === void 0 ? void 0 : _c.hex) || v.colorHexLegacy || null;
            const img = ((_d = v.colors) === null || _d === void 0 ? void 0 : _d.swatchUrl) || v.swatchUrlLegacy || null;
            const colorId = v.colorId || null;
            if (!swatchMap.has(label))
                swatchMap.set(label, { label, hex, img, colorId });
        }
        const swatches = Array.from(swatchMap.values());
        const colors = swatches.map((s) => s.label);
        const sizes = Array.isArray(product.size) ? product.size : [];
        const viewModel = {
            id: product.id,
            slug: product.slug,
            title: product.title,
            description: product.description,
            category: (_e = product.categories) === null || _e === void 0 ? void 0 : _e.title,
            categorySlug: (_f = product.categories) === null || _f === void 0 ? void 0 : _f.slug,
            priceText: formatVnd(rawPrice),
            finalPriceText: formatVnd(finalPrice),
            discount: discountValue,
            thumbnail: product.thumbnail,
            allImages,
            swatches,
            colors,
            selectedColor: (_g = colors[0]) !== null && _g !== void 0 ? _g : null,
            sizes,
            selectedSize: (_h = sizes[0]) !== null && _h !== void 0 ? _h : null,
            vouchers: ["Giảm 50K"],
            freeShip: true,
            productVariants: prismaVariants,
        };
        res.render("client/pages/product/detail", { product: viewModel });
    }
    catch (error) {
        console.error("PRODUCT DETAIL ERROR", error);
        res.status(500).render("client/pages/product/detail", { product: null });
    }
});
exports.detail = detail;
