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
exports.toggleStatus = exports.softDeleteCategory = exports.updateCategory = exports.editCategoryForm = exports.createCategory = exports.showCreateCategory = exports.getCategories = void 0;
const database_1 = __importDefault(require("../../config/database"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const crypto_1 = require("crypto");
const val = (v) => (typeof v === "string" ? v.trim() : v);
const slugify = (s) => (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "danh-muc";
function uniqueSlug(base) {
    return __awaiter(this, void 0, void 0, function* () {
        let slug = base;
        let i = 1;
        const candidates = yield database_1.default.categories.findMany({
            where: { slug: { startsWith: base } },
            select: { slug: true },
        });
        const taken = new Set(candidates.map((x) => x.slug));
        while (taken.has(slug))
            slug = `${base}-${++i}`;
        return slug;
    });
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
const getCategories = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const allMode = String(req.query.take || '').toLowerCase() === 'all'
        || String(req.query.all || '') === '1';
    const page = Math.max(1, Number(req.query.page) || 1);
    const take = allMode ? undefined : Math.min(50, Number(req.query.take) || 10);
    const skip = allMode ? undefined : (page - 1) * take;
    const findOpts = {
        where: { deleted: false },
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    };
    if (!allMode) {
        findOpts.skip = skip;
        findOpts.take = take;
    }
    const [rows, total] = yield Promise.all([
        database_1.default.categories.findMany(findOpts),
        database_1.default.categories.count({ where: { deleted: false } }),
    ]);
    const categories = rows.map((c) => ({
        id: c.id,
        title: c.title,
        position: c.position,
        status: c.status,
        isFeatured: c.isFeatured,
        createdAt: c.createdAt,
        thumbnail: c.thumbnail || "/images/placeholder.jpg",
    }));
    res.render("admin/pages/categories/list", {
        title: "Category List",
        active: "categories",
        categories,
        pagination: { page, take: (allMode ? total : take || 10), total },
        allMode,
    });
});
exports.getCategories = getCategories;
const showCreateCategory = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const parents = yield database_1.default.categories.findMany({
        where: { deleted: false, status: 'active' },
        select: { id: true, title: true },
        orderBy: { title: 'asc' },
    });
    res.render("admin/pages/categories/create", { title: "Create Category", active: "categories", parents });
});
exports.showCreateCategory = showCreateCategory;
const createCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const b = req.body;
        const files = req.files || [];
        const title = val(b.title);
        const parentId = val(b.parentId) || null;
        const description = val(b.description) || null;
        const status = (b.status === "inactive" ? "inactive" : "active");
        const isFeatured = String(b.isFeatured) === 'on' || String(b.isFeatured) === '1';
        const position = Number.isFinite(Number(b.position)) ? Math.trunc(Number(b.position)) : 0;
        const thumbUrl = val(b.thumbnailUrl);
        let thumbnail = "";
        if (thumbUrl)
            thumbnail = thumbUrl;
        else {
            const f = files.find((x) => x.fieldname === 'thumbnail');
            if (f)
                thumbnail = yield saveFileToPublic(f);
        }
        if (!title)
            return res.status(400).send("Missing title");
        const baseSlug = slugify(String(title));
        const slug = yield uniqueSlug(baseSlug);
        const id = (0, crypto_1.randomUUID)();
        yield database_1.default.categories.create({
            data: {
                id,
                title: String(title),
                parentId: parentId || undefined,
                description,
                thumbnail: thumbnail || null,
                status,
                isFeatured,
                slug,
                position,
            },
        });
        res.redirect(303, "/admin/categories");
    }
    catch (err) {
        console.error("Create category failed", err);
        res.status(500).send("Create failed");
    }
});
exports.createCategory = createCategory;
const editCategoryForm = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const row = yield database_1.default.categories.findUnique({ where: { id } });
    if (!row || row.deleted)
        return res.status(404).send("Not found");
    const parents = yield database_1.default.categories.findMany({
        where: { deleted: false, status: 'active', NOT: { id } },
        select: { id: true, title: true },
        orderBy: { title: 'asc' },
    });
    res.render("admin/pages/categories/edit", { title: "Edit Category", active: "categories", row, parents });
});
exports.editCategoryForm = editCategoryForm;
const updateCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const b = req.body;
        const files = req.files || [];
        const title = val(b.title);
        const parentId = val(b.parentId) || null;
        const description = val(b.description) || null;
        const status = (b.status === "inactive" ? "inactive" : "active");
        const isFeatured = String(b.isFeatured) === 'on' || String(b.isFeatured) === '1';
        const position = Number.isFinite(Number(b.position)) ? Math.trunc(Number(b.position)) : 0;
        const thumbUrl = val(b.thumbnailUrl);
        let thumbnail = undefined;
        if (thumbUrl)
            thumbnail = thumbUrl;
        else {
            const f = files.find((x) => x.fieldname === 'thumbnail');
            if (f)
                thumbnail = yield saveFileToPublic(f);
        }
        const data = {
            title: String(title || ""),
            parentId: parentId || undefined,
            description,
            status,
            isFeatured,
            position,
            updatedAt: new Date(),
        };
        if (thumbnail)
            data.thumbnail = thumbnail;
        yield database_1.default.categories.update({ where: { id }, data });
        res.redirect(303, "/admin/categories");
    }
    catch (err) {
        console.error("Update category failed", err);
        res.status(500).send("Update failed");
    }
});
exports.updateCategory = updateCategory;
const softDeleteCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield database_1.default.categories.update({ where: { id }, data: { deleted: true, deletedAt: new Date(), updatedAt: new Date() } });
        res.redirect("/admin/categories?deleted=1");
    }
    catch (err) {
        console.error("Delete category failed", err);
        res.status(500).send("Delete failed");
    }
});
exports.softDeleteCategory = softDeleteCategory;
const toggleStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const row = yield database_1.default.categories.findUnique({ where: { id }, select: { status: true } });
        if (!row)
            return res.status(404).send("Not found");
        const next = row.status === "active" ? "inactive" : "active";
        yield database_1.default.categories.update({ where: { id }, data: { status: next, updatedAt: new Date() } });
        res.redirect("/admin/categories");
    }
    catch (err) {
        console.error("Toggle category status failed", err);
        res.status(500).send("Toggle failed");
    }
});
exports.toggleStatus = toggleStatus;
