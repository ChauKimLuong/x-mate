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
const category_nav_1 = require("../../utils/category-nav");
const DEFAULT_SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];
const toNumber = (v) => (isNaN(Number(v)) ? null : Number(v));
const buildColorPalette = (product) => {
    const colorMap = new Map();
    const recordColor = (nameRaw, hexRaw, swatchRaw, imageRaw) => {
        var _a;
        const name = (_a = nameRaw === null || nameRaw === void 0 ? void 0 : nameRaw.trim()) !== null && _a !== void 0 ? _a : "";
        const hexCandidate = typeof hexRaw === "string" ? hexRaw.trim() : "";
        const swatchCandidate = typeof swatchRaw === "string" ? swatchRaw.trim() : "";
        const imageCandidate = typeof imageRaw === "string" ? imageRaw.trim() : "";
        let hex = "";
        if (hexCandidate && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hexCandidate)) {
            hex = hexCandidate;
        }
        else if (name.startsWith("#") && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(name)) {
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
    prismaVariants.forEach((variant) => {
        var _a, _b, _c, _d, _e, _f, _g;
        const variantColor = (_a = variant === null || variant === void 0 ? void 0 : variant.colors) !== null && _a !== void 0 ? _a : null;
        recordColor((_c = (_b = variant === null || variant === void 0 ? void 0 : variant.color) !== null && _b !== void 0 ? _b : variantColor === null || variantColor === void 0 ? void 0 : variantColor.name) !== null && _c !== void 0 ? _c : null, (_e = (_d = variant === null || variant === void 0 ? void 0 : variant.colorHexLegacy) !== null && _d !== void 0 ? _d : variantColor === null || variantColor === void 0 ? void 0 : variantColor.hex) !== null && _e !== void 0 ? _e : null, (_g = (_f = variantColor === null || variantColor === void 0 ? void 0 : variantColor.swatchUrl) !== null && _f !== void 0 ? _f : variant === null || variant === void 0 ? void 0 : variant.swatchUrlLegacy) !== null && _g !== void 0 ? _g : null, Array.isArray(variant === null || variant === void 0 ? void 0 : variant.images) && variant.images.length ? variant.images[0] : null);
    });
    const legacyVariants = Array.isArray(product === null || product === void 0 ? void 0 : product.variants)
        ? product === null || product === void 0 ? void 0 : product.variants
        : [];
    legacyVariants.forEach((variant) => {
        var _a, _b, _c, _d;
        recordColor((_a = variant === null || variant === void 0 ? void 0 : variant.color) !== null && _a !== void 0 ? _a : null, (_c = (_b = variant === null || variant === void 0 ? void 0 : variant.colorHexLegacy) !== null && _b !== void 0 ? _b : variant === null || variant === void 0 ? void 0 : variant.colorHex) !== null && _c !== void 0 ? _c : null, (_d = variant === null || variant === void 0 ? void 0 : variant.swatchUrlLegacy) !== null && _d !== void 0 ? _d : null, Array.isArray(variant === null || variant === void 0 ? void 0 : variant.images) && variant.images.length ? variant.images[0] : null);
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
            ("name" in colorValue || "hex" in colorValue || "swatchUrl" in colorValue)) {
            recordColor((_a = colorValue.name) !== null && _a !== void 0 ? _a : null, (_b = colorValue.hex) !== null && _b !== void 0 ? _b : null, (_c = colorValue.swatchUrl) !== null && _c !== void 0 ? _c : null, (_d = colorValue.image) !== null && _d !== void 0 ? _d : null);
        }
    });
    return Array.from(colorMap.values()).slice(0, 5);
};
const formatCurrency = (a) => new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
}).format(Math.max(0, Math.round(a)));
const getAllDescendantIds = (parentId) => __awaiter(void 0, void 0, void 0, function* () {
    const children = yield database_1.default.categories.findMany({
        where: { parentId, deleted: false },
        select: { id: true },
    });
    if (!children.length)
        return [];
    const childIds = children.map((c) => c.id);
    const grandChildIds = (yield Promise.all(childIds.map((id) => getAllDescendantIds(id)))).flat();
    return [...childIds, ...grandChildIds];
});
const buildProductCardData = (product) => {
    var _a, _b, _c, _d;
    const rawPrice = (_a = toNumber(product.price)) !== null && _a !== void 0 ? _a : 0;
    const discount = (_b = toNumber(product.discount)) !== null && _b !== void 0 ? _b : 0;
    const priceAfter = discount
        ? Math.round((rawPrice * (100 - discount)) / 100)
        : rawPrice;
    const imgs = [
        product.thumbnail,
        ...((_d = (_c = product.productVariants) === null || _c === void 0 ? void 0 : _c.flatMap((v) => v.images || [])) !== null && _d !== void 0 ? _d : []),
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
        sizes: Array.isArray(product.size) && product.size.length
            ? product.size
            : DEFAULT_SIZES,
        colors: buildColorPalette(product),
    };
};
const detail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { slug } = req.params;
        const [parent, allCategories] = yield Promise.all([
            database_1.default.categories.findFirst({
                where: { slug, deleted: false },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    description: true,
                    thumbnail: true,
                },
            }),
            database_1.default.categories.findMany({
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
        const childCategories = yield database_1.default.categories.findMany({
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
        const descendantIds = yield getAllDescendantIds(parent.id);
        const categoryIds = [parent.id, ...descendantIds];
        const products = yield database_1.default.products.findMany({
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
        const primaryCategories = (0, category_nav_1.buildPrimaryNav)(allCategories);
        res.locals.primaryCategories = primaryCategories;
        return res.render("client/pages/category/index", {
            parent,
            children: childCategories,
            products: viewProducts,
            primaryCategories,
        });
    }
    catch (err) {
        console.error("CATEGORY DETAIL ERROR:", err);
        res.status(500).render("client/pages/category/index", {
            parent: null,
            children: [],
            products: [],
            primaryCategories: [],
        });
    }
});
exports.detail = detail;
