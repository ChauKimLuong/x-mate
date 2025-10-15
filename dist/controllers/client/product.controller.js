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
    var _a, _b, _c, _d, _e;
    try {
        const { slug } = req.params;
        const product = yield database_1.default.products.findFirst({
            where: { slug, deleted: false },
            include: { productVariants: true, categories: true },
        });
        if (!product) {
            return res.status(404).render("client/pages/product/detail", { product: null });
        }
        const prismaVariants = (_a = product.productVariants) !== null && _a !== void 0 ? _a : [];
        const baseImages = Array.isArray(product.images) ? product.images : [];
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
            ...(product.colors || []),
        ])).slice(0, 5);
        const sizes = (_b = product.size) !== null && _b !== void 0 ? _b : [];
        const viewModel = {
            id: product.id,
            title: product.title,
            description: product.description,
            category: (_c = product.categories) === null || _c === void 0 ? void 0 : _c.title,
            priceText: formatVnd(rawPrice),
            finalPriceText: formatVnd(finalPrice),
            discount: discountValue,
            thumbnail: product.thumbnail,
            allImages,
            colors,
            selectedColor: (_d = colors[0]) !== null && _d !== void 0 ? _d : null,
            sizes,
            selectedSize: (_e = sizes[0]) !== null && _e !== void 0 ? _e : null,
            vouchers: ["Giảm 50K"],
            freeShip: true,
        };
        res.render("client/pages/product/detail", { product: viewModel });
    }
    catch (error) {
        console.error("PRODUCT DETAIL ERROR", error);
        res.status(500).render("client/pages/product/detail", { product: null });
    }
});
exports.detail = detail;
