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
exports.toggleStatus = exports.softDeleteProduct = exports.updateProduct = exports.editProductForm = exports.showProduct = exports.createProduct = exports.showCreateProduct = exports.getProducts = void 0;
const database_1 = __importDefault(require("../../config/database"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const crypto_1 = require("crypto");
const qs_1 = __importDefault(require("qs"));
const formatMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const toInt = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0);
const val = (v) => (typeof v === "string" ? v.trim() : v);
const slugify = (s) => (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "san-pham";
function uniqueSlug(base) {
    return __awaiter(this, void 0, void 0, function* () {
        let slug = base;
        let i = 1;
        const candidates = yield database_1.default.products.findMany({
            where: { slug: { startsWith: base } },
            select: { slug: true },
        });
        const taken = new Set(candidates.map((x) => x.slug));
        while (taken.has(slug))
            slug = `${base}-${++i}`;
        return slug;
    });
}
const normColor = (s) => (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
function getRange(range) {
    const now = new Date();
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (range === "today") {
        const s = startOfDay(now);
        const e = new Date(s);
        e.setDate(e.getDate() + 1);
        return { s, e, label: "Today" };
    }
    if (range === "week") {
        const d = new Date(now);
        const day = d.getDay() || 7;
        const s = startOfDay(new Date(d));
        s.setDate(s.getDate() - (day - 1));
        const e = new Date(s);
        e.setDate(e.getDate() + 7);
        return { s, e, label: "This Week" };
    }
    if (range === "year") {
        const s = new Date(now.getFullYear(), 0, 1);
        const e = new Date(now.getFullYear() + 1, 0, 1);
        return { s, e, label: "This Year" };
    }
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { s, e, label: "This Month" };
}
function saveFileToPublic(file_1) {
    return __awaiter(this, arguments, void 0, function* (file, destDir = "public/uploads") {
        const ext = (file.originalname.split(".").pop() || "bin").toLowerCase().split("?")[0];
        const id = (0, crypto_1.randomUUID)();
        const rel = `${destDir}/${id}.${ext}`;
        const abs = path_1.default.join(process.cwd(), rel);
        yield promises_1.default.mkdir(path_1.default.dirname(abs), { recursive: true });
        yield promises_1.default.writeFile(abs, file.buffer);
        return "/" + rel.replace(/^public\//, "");
    });
}
const getProducts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = Math.max(1, Number(req.query.page) || 1);
    const take = Math.min(50, Number(req.query.take) || 10);
    const skip = (page - 1) * take;
    const range = String(req.query.range || "month");
    const { s, e, label } = getRange(range);
    const createdFilter = { createdAt: { gte: s, lt: e } };
    const [rows, total] = yield Promise.all([
        database_1.default.products.findMany({
            where: Object.assign({ deleted: false }, createdFilter),
            include: {
                categories: { select: { title: true } },
                productVariants: {
                    select: { stock: true, images: true, color: true },
                },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take,
        }),
        database_1.default.products.count({ where: Object.assign({ deleted: false }, createdFilter) }),
    ]);
    const products = rows.map((p) => {
        var _a;
        const variants = Array.isArray(p.productVariants) ? p.productVariants : [];
        const variantImages = variants.flatMap(v => Array.isArray(v.images) ? v.images : []);
        const firstVariantImg = variantImages.find(Boolean);
        const img = p.thumbnail || firstVariantImg || "/images/placeholder.jpg";
        const stockLeft = variants.reduce((sum, v) => sum + (toInt(v.stock) || 0), 0);
        const sizes = Array.isArray(p.size) ? p.size : [];
        return {
            id: p.id,
            img,
            name: p.title,
            sizes,
            priceText: formatMoney(p.price),
            left: stockLeft,
            sold: p.soldCount,
            category: ((_a = p.categories) === null || _a === void 0 ? void 0 : _a.title) || "—",
            rating: p.ratingAvg,
            reviews: p.ratingCount,
            slug: p.slug,
        };
    });
    res.render("admin/pages/products/list", {
        title: "Product List",
        active: "products",
        products,
        pagination: { page, take, total },
        filterLabel: label,
        range,
    });
});
exports.getProducts = getProducts;
const showCreateProduct = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const [categories, pv] = yield Promise.all([
        database_1.default.categories.findMany({
            where: { deleted: false, status: "active" },
            select: { id: true, title: true },
            orderBy: { title: "asc" },
        }),
        database_1.default.productVariants.findMany({
            select: { color: true, images: true },
            take: 500,
        }),
    ]);
    const samplesByColor = {};
    const colorSet = new Set();
    for (const v of pv) {
        const original = (v.color || "").trim();
        if (!original)
            continue;
        colorSet.add(original);
        const key = normColor(original);
        (samplesByColor[key] || (samplesByColor[key] = []));
        (v.images || []).forEach(u => { if (u)
            samplesByColor[key].push(u); });
    }
    const colors = Array.from(colorSet).sort((a, b) => a.localeCompare(b));
    res.render("admin/pages/products/create", {
        title: "Create Product", active: "products",
        categories, variantOptions: { colors, samplesByColor },
    });
});
exports.showCreateProduct = showCreateProduct;
const createProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    try {
        const b = req.body;
        const files = req.files || [];
        const title = val(b.title);
        const categoryId = val(b.categoryId);
        const status = (b.status === "inactive" ? "inactive" : "active");
        const price = toInt(b.price);
        const discount = toInt(b.discount);
        const description = val(b.description);
        const sizeRaw = (_b = (_a = b["size[]"]) !== null && _a !== void 0 ? _a : b.size) !== null && _b !== void 0 ? _b : [];
        const sizes = Array.isArray(sizeRaw) ? sizeRaw.filter(Boolean) : (sizeRaw ? [String(sizeRaw)] : []);
        const thumbnailUrl = val(b.thumbnailUrl);
        let thumbnail = "";
        if (thumbnailUrl)
            thumbnail = thumbnailUrl;
        else {
            const thumbFile = files.find((f) => f.fieldname === "thumbnail");
            if (thumbFile)
                thumbnail = yield saveFileToPublic(thumbFile);
        }
        if (!title || !categoryId || !thumbnail) {
            return res.status(400).send("Missing required fields (title/category/thumbnail).");
        }
        const baseSlug = slugify(String(title));
        const slug = yield uniqueSlug(baseSlug);
        const variantMap = {};
        let vRaw = null;
        if (typeof b.variants === "string") {
            try {
                vRaw = JSON.parse(b.variants);
            }
            catch (_l) { }
        }
        else if (b.variants && typeof b.variants === "object") {
            vRaw = b.variants;
        }
        if (Array.isArray(vRaw)) {
            vRaw.forEach((node, i) => {
                const item = { urls: [], files: [] };
                if (node) {
                    if (node.color != null)
                        item.color = val(node.color);
                    if (node.stock != null)
                        item.stock = toInt(node.stock);
                    if (node.colorId != null)
                        item.colorId = val(node.colorId) || null;
                    if (node.colorHexLegacy != null)
                        item.colorHexLegacy = val(node.colorHexLegacy) || null;
                    if (node.swatchUrlLegacy != null)
                        item.swatchUrlLegacy = val(node.swatchUrlLegacy) || null;
                    const raw = node.imageUrls;
                    const pushLines = (t) => String(t || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach(u => item.urls.push(u));
                    Array.isArray(raw) ? raw.forEach(pushLines) : raw && pushLines(raw);
                }
                variantMap[String(i)] = item;
            });
        }
        if (vRaw && typeof vRaw === "object" && !Array.isArray(vRaw)) {
            for (const idx of Object.keys(vRaw)) {
                const node = vRaw[idx] || {};
                const item = { urls: [], files: [] };
                if (node.color != null)
                    item.color = val(node.color);
                if (node.stock != null)
                    item.stock = toInt(node.stock);
                if (node.colorId != null)
                    item.colorId = val(node.colorId) || null;
                if (node.colorHexLegacy != null)
                    item.colorHexLegacy = val(node.colorHexLegacy) || null;
                if (node.swatchUrlLegacy != null)
                    item.swatchUrlLegacy = val(node.swatchUrlLegacy) || null;
                const raw = node.imageUrls;
                const pushLines = (t) => String(t || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach(u => item.urls.push(u));
                Array.isArray(raw) ? raw.forEach(pushLines) : raw && pushLines(raw);
                variantMap[idx] = item;
            }
        }
        Object.keys(b).forEach((k) => {
            const m = k.match(/^variants\[(\d+)\]\[(color|stock|imageUrls|colorId|colorHexLegacy|swatchUrlLegacy)\](?:\[\])?$/);
            if (!m)
                return;
            const idx = m[1];
            const field = m[2];
            variantMap[idx] || (variantMap[idx] = { urls: [], files: [] });
            if (field === "color")
                variantMap[idx].color = val(b[k]);
            else if (field === "stock")
                variantMap[idx].stock = toInt(b[k]);
            else if (field === "imageUrls") {
                const raw = b[k];
                const pushLines = (t) => String(t || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean).forEach((u) => variantMap[idx].urls.push(u));
                Array.isArray(raw) ? raw.forEach(pushLines) : raw && pushLines(raw);
            }
            else {
                variantMap[idx][field] = val(b[k]) || null;
            }
        });
        files.forEach((f) => {
            const m = f.fieldname.match(/^variants\[(\d+)\]\[images\]\[\]$/);
            if (!m)
                return;
            const idx = m[1];
            variantMap[idx] || (variantMap[idx] = { urls: [], files: [] });
            variantMap[idx].files.push(f);
        });
        const variantsData = [];
        for (const idx of Object.keys(variantMap).sort((a, b) => Number(a) - Number(b))) {
            const v = variantMap[idx];
            if (v.stock === undefined || v.stock === null)
                continue;
            const colorName = (v.color && String(v.color).trim()) || "";
            if (!colorName)
                continue;
            const uploadedUrls = [];
            for (const f of v.files) {
                uploadedUrls.push(yield saveFileToPublic(f, "public/uploads/variants"));
            }
            variantsData.push({
                id: (0, crypto_1.randomUUID)(),
                color: colorName,
                stock: toInt(v.stock),
                images: [...v.urls, ...uploadedUrls],
                colorId: (_c = v.colorId) !== null && _c !== void 0 ? _c : null,
                colorHexLegacy: (_d = v.colorHexLegacy) !== null && _d !== void 0 ? _d : null,
                swatchUrlLegacy: (_e = v.swatchUrlLegacy) !== null && _e !== void 0 ? _e : null,
            });
        }
        if (variantsData.length === 0) {
            console.error("No variants parsed from form payload", { bodyKeys: Object.keys(b).slice(0, 50) });
            return res.status(400).send("No variants provided or parsed.");
        }
        const colorNeedsMap = new Map();
        for (const v of variantsData) {
            if (!v.colorId) {
                const name = (_f = v.color) === null || _f === void 0 ? void 0 : _f.trim();
                if (!name)
                    continue;
                const slug = slugify(name);
                const cur = colorNeedsMap.get(slug) || { slug, name, hex: null, swatchUrl: null };
                if (!cur.hex && v.colorHexLegacy)
                    cur.hex = v.colorHexLegacy;
                if (!cur.swatchUrl && v.swatchUrlLegacy)
                    cur.swatchUrl = v.swatchUrlLegacy;
                colorNeedsMap.set(slug, cur);
            }
        }
        const upsertedColorIdsBySlug = {};
        for (const need of colorNeedsMap.values()) {
            const created = yield database_1.default.colors.upsert({
                where: { slug: need.slug },
                update: {
                    name: need.name,
                    hex: (_g = need.hex) !== null && _g !== void 0 ? _g : undefined,
                    swatchUrl: (_h = need.swatchUrl) !== null && _h !== void 0 ? _h : undefined,
                    updatedAt: new Date(),
                },
                create: {
                    id: (0, crypto_1.randomUUID)(),
                    name: need.name,
                    slug: need.slug,
                    hex: (_j = need.hex) !== null && _j !== void 0 ? _j : undefined,
                    swatchUrl: (_k = need.swatchUrl) !== null && _k !== void 0 ? _k : undefined,
                },
                select: { id: true, slug: true },
            });
            upsertedColorIdsBySlug[created.slug] = created.id;
        }
        for (const v of variantsData) {
            if (!v.colorId) {
                const slug = slugify(v.color);
                const cid = upsertedColorIdsBySlug[slug];
                if (cid)
                    v.colorId = cid;
            }
        }
        const productId = (0, crypto_1.randomUUID)();
        yield database_1.default.products.create({
            data: {
                id: productId,
                title: String(title),
                description: description !== null && description !== void 0 ? description : null,
                price,
                discount,
                categoryId: String(categoryId),
                size: sizes,
                thumbnail,
                status,
                slug,
                productVariants: {
                    create: variantsData.map((v) => ({
                        id: v.id,
                        color: v.color,
                        stock: v.stock,
                        images: v.images,
                        colorId: v.colorId,
                        colorHexLegacy: v.colorHexLegacy,
                        swatchUrlLegacy: v.swatchUrlLegacy,
                    })),
                },
            },
        });
        res.redirect(`/admin/products?created=1`);
    }
    catch (err) {
        console.error("Create product failed.", err);
        res.status(500).send("Create product failed.");
    }
});
exports.createProduct = createProduct;
const showProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const row = yield database_1.default.products.findUnique({
            where: { id },
            include: {
                categories: { select: { id: true, title: true } },
                productVariants: {
                    include: { colors: { select: { id: true, name: true, hex: true, swatchUrl: true } } },
                    orderBy: { id: 'asc' },
                }
            },
        });
        if (!row)
            return res.status(404).render("admin/pages/products/view", { product: null });
        const stockLeft = row.productVariants.reduce((s, v) => s + ((Number(v.stock) || 0)), 0);
        const statusText = row.status === 'inactive' ? 'Inactive' : 'Active';
        const statusClass = row.status === 'inactive' ? 'pv-badge pv-badge--muted' : 'pv-badge pv-badge--ok';
        const viewModel = Object.assign(Object.assign({}, row), { categoryTitle: ((_a = row.categories) === null || _a === void 0 ? void 0 : _a.title) || '—', priceText: (Number(row.price) || 0).toLocaleString("vi-VN") + "đ", stockLeft, variantCount: row.productVariants.length, images: [row.thumbnail, ...row.productVariants.flatMap(v => v.images || [])].filter(Boolean), statusText,
            statusClass });
        return res.render("admin/pages/products/view", {
            title: "Product Detail",
            active: "products",
            product: viewModel,
        });
    }
    catch (err) {
        console.error("showProduct error:", err);
        if (!res.headersSent)
            return res.status(500).send("Internal error.");
    }
});
exports.showProduct = showProduct;
const editProductForm = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        console.log("🟡 editProductForm -> req.params.id =", id);
        if (!id || id === "undefined" || id === ":id") {
            console.error("❌ editProductForm: missing or invalid id param");
            return res.status(400).send("Missing or invalid product ID in URL.");
        }
        const [row, categories] = yield Promise.all([
            database_1.default.products.findUnique({
                where: { id },
                include: {
                    productVariants: {
                        include: {
                            colors: {
                                select: { id: true, name: true, hex: true, swatchUrl: true },
                            },
                        },
                        orderBy: { id: "asc" },
                    },
                    categories: { select: { id: true, title: true } },
                },
            }),
            database_1.default.categories.findMany({
                where: { deleted: false, status: "active" },
                select: { id: true, title: true },
                orderBy: { title: "asc" },
            }),
        ]);
        console.log("🟢 editProductForm -> row?.id =", row === null || row === void 0 ? void 0 : row.id);
        if (!row) {
            return res.status(404).render("admin/pages/products/edit", {
                title: "Edit Product (Not Found)",
                active: "products",
                product: null,
                categories,
            });
        }
        return res.render("admin/pages/products/edit", {
            title: `Edit Product: ${row.title}`,
            active: "products",
            product: row,
            categories,
        });
    }
    catch (err) {
        console.error("💥 editProductForm error:", err);
        if (!res.headersSent) {
            res.status(500).send("Internal server error while loading edit form.");
        }
    }
});
exports.editProductForm = editProductForm;
const updateProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    try {
        const { id } = req.params;
        if (!id) {
            console.error("❌ updateProduct: Missing id param");
            return res.status(400).send("Missing product id.");
        }
        console.log("🟢 updateProduct -> req.params.id =", id);
        const b = qs_1.default.parse(req.body);
        const files = req.files || [];
        const toIntStrict = (v) => {
            if (v === undefined || v === null)
                return undefined;
            const s = String(v).trim().replace(/[,\s.]/g, "");
            if (s === "")
                return undefined;
            const n = Number(s);
            return Number.isFinite(n) ? Math.trunc(n) : undefined;
        };
        const isHttpUrl = (s) => /^https?:\/\//i.test(String(s || "").trim());
        const pushLines = (t, into) => String(t || "")
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((u) => into.push(u));
        const title = (b.title || "").trim();
        const categoryId = (b.categoryId || "").trim();
        const status = b.status === "inactive" ? "inactive" : "active";
        const price = (_a = toIntStrict(b.price)) !== null && _a !== void 0 ? _a : 0;
        const discount = (_b = toIntStrict(b.discount)) !== null && _b !== void 0 ? _b : 0;
        const description = typeof b.description === "string" ? b.description : null;
        const sizeRaw = (_d = (_c = b["size[]"]) !== null && _c !== void 0 ? _c : b.size) !== null && _d !== void 0 ? _d : [];
        const sizes = Array.isArray(sizeRaw) ? sizeRaw.filter(Boolean) : sizeRaw ? [String(sizeRaw)] : [];
        const thumbnailUrl = (b.thumbnailUrl || "").trim();
        let thumbnail = undefined;
        if (thumbnailUrl) {
            thumbnail = thumbnailUrl;
        }
        else {
            const thumbFile = files.find((f) => f.fieldname === "thumbnail");
            if (thumbFile)
                thumbnail = yield saveFileToPublic(thumbFile);
        }
        const variantMap = {};
        const vRaw = (b && b.variants) || undefined;
        if (vRaw && typeof vRaw === "object") {
            const assignFromNode = (idx, node) => {
                const it = (variantMap[idx] || (variantMap[idx] = { urls: [], files: [] }));
                if (node == null)
                    return;
                if (node.id != null)
                    it.id = String(node.id || "").trim() || null;
                if (node._delete != null)
                    it._delete = node._delete === "1" || node._delete === true || node._delete === "true";
                if (node.color != null)
                    it.color = typeof node.color === "string" ? node.color.trim() : node.color;
                if (node.stock != null) {
                    const maybe = toIntStrict(node.stock);
                    if (maybe !== undefined && maybe >= 0)
                        it.stock = maybe;
                }
                if (node.colorHexLegacy != null)
                    it.colorHexLegacy = String(node.colorHexLegacy || "").trim() || null;
                if (node.swatchUrlLegacy != null)
                    it.swatchUrlLegacy = String(node.swatchUrlLegacy || "").trim() || null;
                if (node.imagesMode != null) {
                    const v = String(node.imagesMode || "").toLowerCase();
                    it.imagesMode = v === "replace" ? "replace" : "append";
                }
                if (node.imageUrls != null) {
                    if (Array.isArray(node.imageUrls))
                        node.imageUrls.forEach((t) => pushLines(t, it.urls));
                    else
                        pushLines(String(node.imageUrls || ""), it.urls);
                }
            };
            if (Array.isArray(vRaw)) {
                vRaw.forEach((node, i) => assignFromNode(String(i), node));
            }
            else {
                Object.keys(vRaw).forEach((k) => assignFromNode(k, vRaw[k]));
            }
        }
        Object.keys(req.body || {}).forEach((key) => {
            const m = key.match(/^variants\[([\w-]+)\]\[(id|_delete|color|stock|imageUrls|colorHexLegacy|swatchUrlLegacy|imagesMode)\](?:\[\])?$/);
            if (!m)
                return;
            const idx = m[1];
            const field = m[2];
            const it = (variantMap[idx] || (variantMap[idx] = { urls: [], files: [] }));
            const rawVal = req.body[key];
            if (field === "imageUrls") {
                Array.isArray(rawVal) ? rawVal.forEach((t) => pushLines(t, it.urls)) : pushLines(String(rawVal || ""), it.urls);
                return;
            }
            if (field === "stock") {
                const maybe = toIntStrict(rawVal);
                if (maybe !== undefined && maybe >= 0)
                    it.stock = maybe;
                return;
            }
            if (field === "_delete") {
                it._delete = rawVal === "1" || rawVal === "true" || rawVal === true;
                return;
            }
            if (field === "id") {
                it.id = (String(rawVal || "").trim() || null);
                return;
            }
            if (field === "imagesMode") {
                const v = String(rawVal || "").toLowerCase();
                it.imagesMode = v === "replace" ? "replace" : "append";
                return;
            }
            it[field] = typeof rawVal === "string" ? rawVal.trim() : rawVal;
        });
        files.forEach((f) => {
            const mm = f.fieldname.match(/^variants\[([\w-]+)\]\[images\]\[\]$/);
            if (!mm)
                return;
            const idx = mm[1];
            (variantMap[idx] || (variantMap[idx] = { urls: [], files: [] })).files.push(f);
        });
        const keys = Object.keys(variantMap).sort((a, b) => Number(a) - Number(b));
        console.log("VARIANT MAP KEYS:", keys);
        for (const k of keys) {
            const v = variantMap[k];
            console.log(" -", k, { id: v.id, color: v.color, stock: v.stock, urls: (_e = v.urls) === null || _e === void 0 ? void 0 : _e.length, files: (_f = v.files) === null || _f === void 0 ? void 0 : _f.length });
        }
        for (const idx of keys) {
            const v = variantMap[idx];
            const uploaded = [];
            for (const f of v.files) {
                uploaded.push(yield saveFileToPublic(f, "public/uploads/variants"));
            }
            v._uploadedUrls = uploaded;
        }
        const current = yield database_1.default.productVariants.findMany({
            where: { productId: id },
            select: { id: true, images: true },
        });
        const currentImgMap = new Map(current.map((v) => [v.id, Array.isArray(v.images) ? v.images : []]));
        yield database_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            yield tx.products.update({
                where: { id },
                data: Object.assign(Object.assign({ title,
                    description,
                    price,
                    discount,
                    categoryId, size: sizes, status }, (thumbnail ? { thumbnail } : {})), { updatedAt: new Date() }),
            });
            for (const idx of keys) {
                const v = variantMap[idx];
                let colorHexLegacy = (v.colorHexLegacy || "");
                let swatchUrlLegacy = (v.swatchUrlLegacy || "");
                const hexOk = /^#?[0-9a-fA-F]{3}$/.test(colorHexLegacy) || /^#?[0-9a-fA-F]{6}$/.test(colorHexLegacy);
                const urlOk = isHttpUrl(swatchUrlLegacy);
                if (urlOk)
                    colorHexLegacy = "";
                else if (hexOk)
                    swatchUrlLegacy = "";
                else {
                    colorHexLegacy = "";
                    swatchUrlLegacy = "";
                }
                const newCandidateImages = [...(v.urls || []), ...(v._uploadedUrls || [])];
                const mode = v.imagesMode || "append";
                if (v.id) {
                    if (v._delete) {
                        yield tx.productVariants.delete({ where: { id: v.id } });
                        continue;
                    }
                    const data = {};
                    if (typeof v.color === "string" && v.color.trim())
                        data.color = v.color.trim();
                    if (v.stock !== undefined && Number.isFinite(v.stock) && v.stock >= 0)
                        data.stock = v.stock;
                    data.colorHexLegacy = colorHexLegacy || null;
                    data.swatchUrlLegacy = swatchUrlLegacy || null;
                    if (newCandidateImages.length > 0) {
                        if (mode === "append") {
                            const existing = currentImgMap.get(v.id) || [];
                            data.images = [...existing, ...newCandidateImages];
                        }
                        else {
                            data.images = newCandidateImages;
                        }
                    }
                    yield tx.productVariants.update({ where: { id: v.id }, data });
                }
                else {
                    const colorName = (v.color || "").trim();
                    if (!colorName)
                        continue;
                    const stockVal = (_a = toIntStrict(v.stock)) !== null && _a !== void 0 ? _a : 0;
                    yield tx.productVariants.create({
                        data: {
                            id: (0, crypto_1.randomUUID)(),
                            productId: id,
                            color: colorName,
                            stock: stockVal,
                            images: newCandidateImages,
                            colorHexLegacy: colorHexLegacy || null,
                            swatchUrlLegacy: swatchUrlLegacy || null,
                        },
                    });
                }
            }
        }));
        res.redirect(`/admin/products/${id}`);
    }
    catch (err) {
        console.error("Update product (upsert variants) failed.", err);
        if (!res.headersSent)
            res.status(500).send("Update product failed.");
    }
});
exports.updateProduct = updateProduct;
const softDeleteProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield database_1.default.products.update({
            where: { id },
            data: { deleted: true, updatedAt: new Date() },
        });
        res.redirect("/admin/products?deleted=1");
    }
    catch (err) {
        console.error("Soft delete failed.", err);
        res.status(500).send("Delete failed.");
    }
});
exports.softDeleteProduct = softDeleteProduct;
const toggleStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const row = yield database_1.default.products.findUnique({ where: { id }, select: { status: true } });
        if (!row)
            return res.status(404).send("Not found");
        const next = row.status === "active" ? "inactive" : "active";
        yield database_1.default.products.update({ where: { id }, data: { status: next, updatedAt: new Date() } });
        res.redirect("/admin/products?statusChanged=1");
    }
    catch (err) {
        console.error("Toggle status failed.", err);
        res.status(500).send("Toggle failed.");
    }
});
exports.toggleStatus = toggleStatus;
