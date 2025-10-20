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
exports.theThao = exports.sale = exports.hangMoi = exports.search = exports.index = void 0;
const database_1 = __importDefault(require("../../config/database"));
const category_nav_1 = require("../../utils/category-nav");
const DEFAULT_SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];
const toNumber = (value) => {
    if (value === null || value === undefined)
        return null;
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
        const stringified = typeof value.toString === "function"
            ? value.toString()
            : "";
        if (stringified) {
            const parsed = Number(stringified);
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
const buildProductCardData = (product) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const productId = (_a = product === null || product === void 0 ? void 0 : product.id) !== null && _a !== void 0 ? _a : "";
    const productSlug = (_b = product === null || product === void 0 ? void 0 : product.slug) !== null && _b !== void 0 ? _b : "";
    const productTitle = (_c = product === null || product === void 0 ? void 0 : product.title) !== null && _c !== void 0 ? _c : "S???n ph??cm";
    const prismaVariants = Array.isArray(product.productVariants)
        ? product.productVariants
        : [];
    const legacyVariants = Array.isArray(product === null || product === void 0 ? void 0 : product.variants)
        ? product.variants
        : [];
    const legacyVariantImages = legacyVariants.flatMap((variant) => Array.isArray(variant === null || variant === void 0 ? void 0 : variant.images) ? variant.images : []);
    const prismaVariantImages = prismaVariants.flatMap((variant) => Array.isArray(variant === null || variant === void 0 ? void 0 : variant.images) ? variant.images : []);
    const baseImages = Array.isArray(product === null || product === void 0 ? void 0 : product.images)
        ? product === null || product === void 0 ? void 0 : product.images
        : [];
    const allImages = [
        product === null || product === void 0 ? void 0 : product.thumbnail,
        ...prismaVariantImages,
        ...legacyVariantImages,
        ...baseImages,
    ].filter((img) => Boolean(img));
    const thumbnail = (_d = allImages[0]) !== null && _d !== void 0 ? _d : "/images/placeholder.jpg";
    const hoverThumbnail = (_e = allImages.find((img) => img && img !== thumbnail)) !== null && _e !== void 0 ? _e : thumbnail;
    const sizeFromProduct = Array.isArray(product === null || product === void 0 ? void 0 : product.size) ? product.size : [];
    const legacySizes = Array.isArray(product === null || product === void 0 ? void 0 : product.sizes)
        ? product === null || product === void 0 ? void 0 : product.sizes
        : [];
    const sizes = Array.from(new Set([...sizeFromProduct, ...legacySizes]
        .filter((size) => typeof size === "string" && size.trim() !== "")
        .map((size) => size.trim())));
    const resolvedSizes = sizes.length ? sizes : DEFAULT_SIZES;
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
    const colors = Array.from(colorMap.values()).slice(0, 5);
    const rawPrice = (_f = toNumber(product === null || product === void 0 ? void 0 : product.price)) !== null && _f !== void 0 ? _f : 0;
    const discountRaw = (_g = toNumber(product === null || product === void 0 ? void 0 : product.discount)) !== null && _g !== void 0 ? _g : 0;
    const discountPercent = discountRaw > 0 ? discountRaw : 0;
    const priceAfterDiscount = discountPercent > 0
        ? Math.max(0, Math.round(rawPrice * (100 - discountPercent) / 100))
        : rawPrice;
    const finalPriceText = formatCurrency(priceAfterDiscount);
    const originalPriceText = discountPercent > 0 ? formatCurrency(rawPrice) : null;
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
const index = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [products, categories] = yield Promise.all([
            database_1.default.products.findMany({
                include: {
                    productVariants: {
                        include: {
                            colors: true,
                        },
                    },
                    categories: true,
                },
            }),
            database_1.default.categories.findMany({
                where: { status: "active" },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    parentId: true,
                },
            }),
        ]);
        const viewProducts = products.map((product) => buildProductCardData(product));
        const primaryCategories = (0, category_nav_1.buildPrimaryNav)(categories);
        res.locals.searchQuery = "";
        res.locals.primaryCategories = primaryCategories;
        res.render("client/pages/home/index", {
            products: viewProducts,
            isSearch: false,
            searchQuery: "",
            searchTotal: viewProducts.length,
            primaryCategories,
        });
    }
    catch (error) {
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
});
exports.index = index;
const search = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const rawQuery = typeof ((_a = req.query) === null || _a === void 0 ? void 0 : _a.q) === "string" ? req.query.q : "";
    const query = rawQuery.trim();
    if (!query) {
        return res.redirect("/");
    }
    try {
        const [products, categories] = yield Promise.all([
            database_1.default.products.findMany({
                where: {
                    deleted: false,
                    title: {
                        contains: query,
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
            }),
            database_1.default.categories.findMany({
                where: { status: "active" },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    parentId: true,
                },
            }),
        ]);
        const viewProducts = products.map((product) => buildProductCardData(product));
        const primaryCategories = (0, category_nav_1.buildPrimaryNav)(categories);
        res.locals.searchQuery = query;
        res.locals.primaryCategories = primaryCategories;
        res.render("client/pages/home/index", {
            products: viewProducts,
            isSearch: true,
            searchQuery: query,
            searchTotal: viewProducts.length,
            primaryCategories,
        });
    }
    catch (error) {
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
});
exports.search = search;
const hangMoi = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    try {
        const [products, categories] = yield Promise.all([
            database_1.default.products.findMany({
                where: {
                    deleted: false,
                    createdAt: {
                        gte: oneWeekAgo,
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
                orderBy: {
                    createdAt: "desc",
                },
            }),
            database_1.default.categories.findMany({
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
        const viewProducts = products.map((product) => buildProductCardData(product));
        const primaryCategories = (0, category_nav_1.buildPrimaryNav)(categories);
        res.locals.primaryCategories = primaryCategories;
        res.locals.searchQuery = "";
        res.render("client/pages/home/index", {
            products: viewProducts,
            isSearch: false,
            searchQuery: "",
            searchTotal: viewProducts.length,
            primaryCategories,
            summaryHeading: "Hang moi moi tuan",
            summaryHighlight: "Ra mat 7 ngay gan nhat",
            summaryMeta: `${viewProducts.length} san pham`,
        });
    }
    catch (error) {
        console.error("NEW ARRIVALS PAGE ERROR:", error);
        const fallbackCategories = Array.isArray(res.locals.primaryCategories)
            ? res.locals.primaryCategories
            : [];
        res.status(500).render("client/pages/home/index", {
            products: [],
            isSearch: false,
            searchQuery: "",
            searchTotal: 0,
            error: "Khong the tai danh sach hang moi.",
            primaryCategories: fallbackCategories,
            summaryHeading: "Hang moi moi tuan",
            summaryHighlight: "Ra mat 7 ngay gan nhat",
            summaryMeta: "0 san pham",
        });
    }
});
exports.hangMoi = hangMoi;
const sale = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [products, categories] = yield Promise.all([
            database_1.default.products.findMany({
                where: {
                    deleted: false,
                    discount: {
                        gte: 50,
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
                orderBy: {
                    discount: "desc",
                },
            }),
            database_1.default.categories.findMany({
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
        const viewProducts = products.map((product) => buildProductCardData(product));
        const primaryCategories = (0, category_nav_1.buildPrimaryNav)(categories);
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
    }
    catch (error) {
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
});
exports.sale = sale;
const theThao = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [products, categories] = yield Promise.all([
            database_1.default.products.findMany({
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
                    productVariants: {
                        include: {
                            colors: true,
                        },
                    },
                    categories: true,
                },
                orderBy: {
                    updatedAt: "desc",
                },
            }),
            database_1.default.categories.findMany({
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
        const viewProducts = products.map((product) => buildProductCardData(product));
        const primaryCategories = (0, category_nav_1.buildPrimaryNav)(categories);
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
    }
    catch (error) {
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
});
exports.theThao = theThao;
