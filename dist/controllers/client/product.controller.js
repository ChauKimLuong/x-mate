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
const toNumber = (value) => {
    if (value === null || value === undefined)
        return null;
    if (typeof value === "number")
        return Number.isFinite(value) ? value : null;
    if (typeof value === "bigint")
        return Number(value);
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value === "object" && value !== null) {
        const valueWithToString = value;
        if (typeof valueWithToString.toString === "function") {
            const parsed = Number(valueWithToString.toString());
            return Number.isFinite(parsed) ? parsed : null;
        }
    }
    return null;
};
const formatCurrency = (amount) => {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
    }).format(Math.max(0, Math.round(amount)));
};
const buildColorPalette = (product) => {
    const colorMap = new Map();
    const recordColor = (nameRaw, hexRaw, swatchRaw, imageRaw) => {
        var _a;
        const name = (_a = nameRaw === null || nameRaw === void 0 ? void 0 : nameRaw.trim()) !== null && _a !== void 0 ? _a : "";
        const hexCandidate = typeof hexRaw === "string" ? hexRaw.trim() : "";
        const swatchCandidate = typeof swatchRaw === "string" ? swatchRaw.trim() : "";
        const imageCandidate = typeof imageRaw === "string" ? imageRaw.trim() : "";
        let hex = "";
        if (hexCandidate &&
            /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hexCandidate)) {
            hex = hexCandidate;
        }
        else if (name.startsWith("#") &&
            /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(name)) {
            hex = name;
        }
        const swatchUrl = hex ? "" : swatchCandidate;
        const key = (name || hex || swatchUrl || "default").toLowerCase();
        const existing = colorMap.get(key);
        if (existing) {
            if (!existing.name && name)
                existing.name = name;
            if (!existing.hex && hex)
                existing.hex = hex;
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
    const prismaVariants = Array.isArray(product === null || product === void 0 ? void 0 : product.productVariants)
        ? product.productVariants
        : [];
    prismaVariants.forEach((variant) => {
        var _a, _b, _c, _d, _e, _f, _g;
        const variantColor = (_a = variant === null || variant === void 0 ? void 0 : variant.colors) !== null && _a !== void 0 ? _a : null;
        recordColor((_c = (_b = variant === null || variant === void 0 ? void 0 : variant.color) !== null && _b !== void 0 ? _b : variantColor === null || variantColor === void 0 ? void 0 : variantColor.name) !== null && _c !== void 0 ? _c : null, (_e = (_d = variant === null || variant === void 0 ? void 0 : variant.colorHexLegacy) !== null && _d !== void 0 ? _d : variantColor === null || variantColor === void 0 ? void 0 : variantColor.hex) !== null && _e !== void 0 ? _e : null, (_g = (_f = variantColor === null || variantColor === void 0 ? void 0 : variantColor.swatchUrl) !== null && _f !== void 0 ? _f : variant === null || variant === void 0 ? void 0 : variant.swatchUrlLegacy) !== null && _g !== void 0 ? _g : null, Array.isArray(variant === null || variant === void 0 ? void 0 : variant.images) && variant.images.length
            ? variant.images[0]
            : null);
    });
    const legacyVariants = Array.isArray(product === null || product === void 0 ? void 0 : product.variants)
        ? product === null || product === void 0 ? void 0 : product.variants
        : [];
    legacyVariants.forEach((variant) => {
        var _a, _b, _c, _d;
        recordColor((_a = variant === null || variant === void 0 ? void 0 : variant.color) !== null && _a !== void 0 ? _a : null, (_c = (_b = variant === null || variant === void 0 ? void 0 : variant.colorHexLegacy) !== null && _b !== void 0 ? _b : variant === null || variant === void 0 ? void 0 : variant.colorHex) !== null && _c !== void 0 ? _c : null, (_d = variant === null || variant === void 0 ? void 0 : variant.swatchUrlLegacy) !== null && _d !== void 0 ? _d : null, Array.isArray(variant === null || variant === void 0 ? void 0 : variant.images) && variant.images.length
            ? variant.images[0]
            : null);
    });
    const colorField = Array.isArray(product === null || product === void 0 ? void 0 : product.colors) ? product.colors : [];
    colorField.forEach((colorValue) => {
        var _a, _b, _c, _d;
        if (typeof colorValue === "string") {
            const trimmed = colorValue.trim();
            if (!trimmed) {
                return;
            }
            if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
                recordColor("", trimmed, null, null);
            }
            else if (/^https?:\/\//i.test(trimmed)) {
                recordColor("", null, trimmed, null);
            }
            else {
                recordColor(trimmed, null, null, null);
            }
        }
        else if (colorValue &&
            typeof colorValue === "object" &&
            ("name" in colorValue ||
                "hex" in colorValue ||
                "swatchUrl" in colorValue)) {
            recordColor((_a = colorValue.name) !== null && _a !== void 0 ? _a : null, (_b = colorValue.hex) !== null && _b !== void 0 ? _b : null, (_c = colorValue.swatchUrl) !== null && _c !== void 0 ? _c : null, (_d = colorValue.image) !== null && _d !== void 0 ? _d : null);
        }
    });
    return Array.from(colorMap.values()).slice(0, 8);
};
const detail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    try {
        const rawSlug = typeof ((_a = req.params) === null || _a === void 0 ? void 0 : _a.slug) === "string" ? req.params.slug : "";
        const slug = rawSlug.trim();
        if (!slug) {
            return res
                .status(404)
                .render("client/pages/product/detail", { product: null });
        }
        console.log(slug);
        const product = yield database_1.default.products.findFirst({
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
        const variantImages = prismaVariants.flatMap((variant) => Array.isArray(variant.images) ? variant.images : []);
        const baseImages = Array.isArray(product === null || product === void 0 ? void 0 : product.images)
            ? product === null || product === void 0 ? void 0 : product.images
            : [];
        const images = [
            product.thumbnail,
            ...variantImages,
            ...baseImages,
        ].filter((img) => Boolean(img));
        const rawPrice = (_b = toNumber(product.price)) !== null && _b !== void 0 ? _b : 0;
        const discountPercent = Math.max(0, (_c = toNumber(product.discount)) !== null && _c !== void 0 ? _c : 0);
        const priceAfterDiscount = discountPercent > 0
            ? Math.max(0, Math.round((rawPrice * (100 - discountPercent)) / 100))
            : rawPrice;
        const colors = buildColorPalette(product);
        const sizeFromProduct = Array.isArray(product.size) ? product.size : [];
        const legacySizes = Array.isArray(product === null || product === void 0 ? void 0 : product.sizes)
            ? product === null || product === void 0 ? void 0 : product.sizes
            : [];
        const sizes = Array.from(new Set([...sizeFromProduct, ...legacySizes]
            .filter((size) => typeof size === "string" && size.trim() !== "")
            .map((size) => size.trim())));
        const resolvedSizes = sizes.length ? sizes : ["Free Size"];
        const shareUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
        const totalStock = prismaVariants.reduce((sum, variant) => { var _a; return sum + ((_a = toNumber(variant === null || variant === void 0 ? void 0 : variant.stock)) !== null && _a !== void 0 ? _a : 0); }, 0);
        const viewModel = {
            id: product.id,
            slug: product.slug,
            title: product.title,
            description: product.description,
            category: (_e = (_d = product.categories) === null || _d === void 0 ? void 0 : _d.title) !== null && _e !== void 0 ? _e : null,
            categorySlug: (_g = (_f = product.categories) === null || _f === void 0 ? void 0 : _f.slug) !== null && _g !== void 0 ? _g : null,
            priceText: formatCurrency(rawPrice),
            finalPriceText: formatCurrency(priceAfterDiscount),
            discountPercent,
            hasDiscount: discountPercent > 0,
            thumbnail: product.thumbnail,
            images,
            colors,
            defaultColor: (_h = colors[0]) !== null && _h !== void 0 ? _h : null,
            sizes: resolvedSizes,
            defaultSize: (_j = resolvedSizes[0]) !== null && _j !== void 0 ? _j : null,
            stock: totalStock,
            shareUrl,
            vouchers: [],
            freeShip: priceAfterDiscount >= 500000,
            priceForCart: priceAfterDiscount,
        };
        res.render("client/pages/product/detail", { product: viewModel });
    }
    catch (error) {
        console.error("PRODUCT DETAIL ERROR", error);
        res.status(500).render("client/pages/product/detail", {
            product: null,
        });
    }
});
exports.detail = detail;
