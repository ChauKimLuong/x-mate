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
exports.page = page;
exports.lowStock = lowStock;
exports.reorderDraftCsv = reorderDraftCsv;
exports.createStocktake = createStocktake;
exports.viewStocktake = viewStocktake;
exports.downloadStocktake = downloadStocktake;
exports.uploadStocktakeCsv = uploadStocktakeCsv;
exports.postStocktake = postStocktake;
exports.deleteStocktake = deleteStocktake;
exports.stocktakeJson = stocktakeJson;
exports.bulkUpload = bulkUpload;
exports.quickCount = quickCount;
exports.bulkCommit = bulkCommit;
exports.barcode = barcode;
exports.barcodeImage = barcodeImage;
exports.exportCsv = exportCsv;
exports.templateCsv = templateCsv;
exports.diagnostics = diagnostics;
exports.rebuildOnHand = rebuildOnHand;
exports.lookup = lookup;
const database_1 = __importDefault(require("../../config/database"));
const fs_1 = __importDefault(require("fs"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const dayjs_1 = __importDefault(require("dayjs"));
const uuid_1 = require("uuid");
const bwip_js_1 = __importDefault(require("bwip-js"));
const qrcode_1 = __importDefault(require("qrcode"));
const DATA_DIR = path_1.default.join(process.cwd(), "data");
const SESS_FILE = path_1.default.join(DATA_DIR, "stocktake-sessions.json");
function ensureDataDir() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!fs_1.default.existsSync(DATA_DIR))
            yield promises_1.default.mkdir(DATA_DIR, { recursive: true });
        if (!fs_1.default.existsSync(SESS_FILE))
            yield promises_1.default.writeFile(SESS_FILE, "[]", "utf-8");
    });
}
function readSessions() {
    return __awaiter(this, void 0, void 0, function* () {
        yield ensureDataDir();
        const raw = yield promises_1.default.readFile(SESS_FILE, "utf-8");
        try {
            return JSON.parse(raw);
        }
        catch (_a) {
            return [];
        }
    });
}
function writeSessions(arr) {
    return __awaiter(this, void 0, void 0, function* () {
        yield ensureDataDir();
        yield promises_1.default.writeFile(SESS_FILE, JSON.stringify(arr, null, 2), "utf-8");
    });
}
function getRange(range) {
    const now = new Date();
    const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (range === "today") {
        const s = sod(now), e = new Date(s);
        e.setDate(e.getDate() + 1);
        return { s, e, label: "This Day" };
    }
    if (range === "week") {
        const d = new Date(now);
        const dow = d.getDay() || 7;
        const s = sod(new Date(d));
        s.setDate(s.getDate() - (dow - 1));
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
const fmtMoney = (n) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
function parseCsvSimple(text) {
    return text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.split(",").map((x) => x.trim()));
}
function toCsv(rows) {
    const safe = (v) => {
        const s = (v !== null && v !== void 0 ? v : "").toString();
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return rows.map((r) => r.map(safe).join(",")).join("\n");
}
let bulkPreviewCache = null;
function page(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const sessions = (yield readSessions())
                .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                .slice(0, 10);
            const products = yield database_1.default.products.findMany({
                where: { deleted: false, status: "active" },
                select: {
                    id: true,
                    title: true,
                    productVariants: { select: { stock: true } },
                },
            });
            const lowStock = products
                .map((p) => ({
                title: p.title,
                stock: p.productVariants.reduce((s, v) => s + (v.stock || 0), 0),
                reorderPoint: 10,
            }))
                .sort((a, b) => a.stock - b.stock)
                .slice(0, 10);
            const negative = yield database_1.default.productVariants.findMany({
                where: { stock: { lt: 0 } },
                select: { id: true, productId: true, stock: true },
            });
            const orphan = [];
            res.render("admin/pages/inventory-support/helper", {
                title: "Inventory Support",
                active: "inventory-support",
                lowStock,
                sessions,
                bulkPreview: bulkPreviewCache,
                diagnostics: { negative, orphan },
                barcodeUrl: undefined,
                helpers: { money: fmtMoney },
                initTab: undefined,
            });
        }
        catch (e) {
            console.error(e);
            res.status(500).send("InventorySupport page error");
        }
    });
}
function lowStock(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const limit = Math.min(Number(req.query.limit || 10), 200);
            const products = yield database_1.default.products.findMany({
                where: { deleted: false, status: "active" },
                select: {
                    id: true,
                    title: true,
                    productVariants: { select: { stock: true } },
                },
            });
            const rows = products
                .map((p) => ({
                productId: p.id,
                title: p.title,
                stock: p.productVariants.reduce((s, v) => s + (v.stock || 0), 0),
                reorderPoint: 10,
            }))
                .sort((a, b) => a.stock - b.stock)
                .slice(0, limit);
            res.json({ ok: true, rows });
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ ok: false });
        }
    });
}
function reorderDraftCsv(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const products = yield database_1.default.products.findMany({
                where: { deleted: false, status: "active" },
                select: {
                    id: true,
                    title: true,
                    productVariants: { select: { stock: true } },
                },
            });
            const rows = [
                ["productId", "title", "onHand", "reorderPoint", "suggestQty"],
            ];
            products.forEach((p) => {
                const onHand = p.productVariants.reduce((sum, v) => { var _a; return sum + ((_a = v.stock) !== null && _a !== void 0 ? _a : 0); }, 0);
                const rp = 10;
                const suggest = Math.max(0, rp - onHand);
                if (suggest > 0)
                    rows.push([p.id, p.title, onHand, rp, suggest]);
            });
            const csv = toCsv(rows);
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", 'attachment; filename="reorder-draft.csv"');
            res.send(csv);
        }
        catch (e) {
            console.error(e);
            res.status(500).send("Cannot create draft PO");
        }
    });
}
function createStocktake(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { name, scope } = req.body;
            const sess = {
                id: (0, uuid_1.v4)(),
                name: (name === null || name === void 0 ? void 0 : name.trim()) || `Stocktake ${(0, dayjs_1.default)().format("YYYY-MM-DD HH:mm")}`,
                status: "draft",
                scope: scope || "all",
                createdAt: new Date().toISOString(),
            };
            const arr = yield readSessions();
            arr.push(sess);
            yield writeSessions(arr);
            res.redirect("/admin/inventory-support#p-stock");
        }
        catch (e) {
            console.error(e);
            res.status(500).send("Create stocktake error");
        }
    });
}
function viewStocktake(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { sid } = req.params;
            const sessions = (yield readSessions())
                .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                .slice(0, 10);
            const s = sessions.find((x) => x.id === sid);
            if (!s)
                return res.status(404).send("Session not found");
            let rows = [];
            if (s.status === "reviewing" && ((_a = s.lines) === null || _a === void 0 ? void 0 : _a.length)) {
                rows = s.lines.map((r) => {
                    var _a, _b, _c;
                    return ({
                        title: r.title,
                        variantId: r.variantId || null,
                        systemOnHand: (_a = r.systemOnHand) !== null && _a !== void 0 ? _a : "-",
                        counted: (_b = r.counted) !== null && _b !== void 0 ? _b : "-",
                        delta: (_c = r.delta) !== null && _c !== void 0 ? _c : "-",
                    });
                });
            }
            else if (s.status === "posted") {
                const moves = yield database_1.default.inventoryMovements.findMany({
                    where: { note: `stocktake ${s.id}` },
                    select: {
                        variantId: true,
                        productId: true,
                        delta: true,
                        products: { select: { id: true, title: true } },
                    },
                    orderBy: { createdAt: "desc" },
                    take: 500,
                });
                rows = moves.map((m) => {
                    var _a;
                    return ({
                        title: ((_a = m.products) === null || _a === void 0 ? void 0 : _a.title) || m.productId,
                        variantId: m.variantId || null,
                        systemOnHand: "-",
                        counted: "-",
                        delta: m.delta,
                    });
                });
            }
            const products = yield database_1.default.products.findMany({
                where: { deleted: false, status: "active" },
                select: {
                    id: true,
                    title: true,
                    productVariants: { select: { stock: true } },
                },
            });
            const lowStock = products
                .map((p) => ({
                title: p.title,
                stock: p.productVariants.reduce((sum, v) => sum + (v.stock || 0), 0),
                reorderPoint: 10,
            }))
                .sort((a, b) => a.stock - b.stock)
                .slice(0, 10);
            const negative = yield database_1.default.productVariants.findMany({
                where: { stock: { lt: 0 } },
                select: { id: true, productId: true, stock: true },
            });
            res.render("admin/pages/inventory-support/helper", {
                title: "Inventory Support",
                active: "inventory-support",
                lowStock,
                sessions,
                bulkPreview: null,
                diagnostics: { negative, orphan: [] },
                barcodeUrl: undefined,
                helpers: { money: fmtMoney },
                initTab: "p-stock",
                sessionDetail: {
                    session: s,
                    rows,
                },
            });
        }
        catch (e) {
            console.error(e);
            res.status(500).send("View stocktake error");
        }
    });
}
function downloadStocktake(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { sid } = req.params;
            const sessions = yield readSessions();
            const s = sessions.find((x) => x.id === sid);
            if (!s)
                return res.status(404).send("Session not found");
            const variants = yield database_1.default.productVariants.findMany({
                select: {
                    id: true,
                    stock: true,
                    products: {
                        select: {
                            id: true,
                            title: true,
                            status: true,
                            deleted: true,
                        },
                    },
                },
            });
            const rows = [
                ["variantId", "productId", "title", "systemOnHand", "counted"],
            ];
            for (const v of variants) {
                const prod = v.products;
                if (!prod)
                    continue;
                if (s.scope === "active" && (prod.deleted || prod.status !== "active"))
                    continue;
                const on = (_a = v.stock) !== null && _a !== void 0 ? _a : 0;
                if (s.scope === "low") {
                    const rp = 10;
                    if (on > rp)
                        continue;
                }
                rows.push([v.id, prod.id, prod.title, on, ""]);
            }
            const csv = toCsv(rows);
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", `attachment; filename="stocktake-${sid}.csv"`);
            res.send(csv);
        }
        catch (e) {
            console.error(e);
            res.status(500).send("Download stocktake error");
        }
    });
}
function uploadStocktakeCsv(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const { sid } = req.params;
            const sessions = yield readSessions();
            const s = sessions.find((x) => x.id === sid);
            if (!s)
                return res.status(404).send("Session not found");
            const file = req.file;
            if (!(file === null || file === void 0 ? void 0 : file.buffer))
                return res.status(400).send("CSV not found");
            const text = file.buffer.toString("utf-8");
            const rows = parseCsvSimple(text);
            const header = rows.shift();
            if (!header || header[0] !== "variantId")
                return res.status(400).send("Invalid CSV");
            const byVariant = new Map();
            for (const r of rows) {
                const variantId = r[0];
                const counted = Number((_b = (_a = r[4]) !== null && _a !== void 0 ? _a : r[3]) !== null && _b !== void 0 ? _b : "");
                if (variantId)
                    byVariant.set(variantId, Number.isFinite(counted) ? counted : NaN);
            }
            const variants = yield database_1.default.productVariants.findMany({
                where: { id: { in: Array.from(byVariant.keys()) } },
                select: { id: true, stock: true, products: { select: { id: true, title: true } } },
            });
            const preview = variants.map((v) => {
                var _a, _b;
                const counted = byVariant.get(v.id);
                const sys = v.stock || 0;
                const delta = Number.isFinite(counted) ? counted - sys : null;
                return {
                    variantId: v.id,
                    productId: ((_a = v.products) === null || _a === void 0 ? void 0 : _a.id) || "",
                    title: ((_b = v.products) === null || _b === void 0 ? void 0 : _b.title) || v.id,
                    systemOnHand: sys,
                    counted: Number.isFinite(counted) ? counted : null,
                    delta,
                };
            });
            s.status = "reviewing";
            s.lines = preview;
            yield writeSessions(sessions);
            res.redirect(`/admin/inventory-support#p-stock`);
        }
        catch (e) {
            console.error(e);
            res.status(500).send("Upload stocktake error");
        }
    });
}
function postStocktake(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { sid } = req.params;
            const sessions = yield readSessions();
            const s = sessions.find((x) => x.id === sid);
            if (!s)
                return res.status(404).send("Session not found");
            if (!((_a = s.lines) === null || _a === void 0 ? void 0 : _a.length)) {
                return res.status(400).send("No lines to post. Please upload CSV first.");
            }
            const snapshot = s.lines.map(l => (Object.assign({}, l)));
            yield database_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                for (const line of s.lines) {
                    if (line.counted == null || line.delta == null || line.delta === 0)
                        continue;
                    if (!line.productId || !line.variantId)
                        continue;
                    yield tx.inventoryMovements.create({
                        data: {
                            productId: line.productId,
                            variantId: line.variantId,
                            delta: line.delta,
                            reason: "manualAdjust",
                            note: `stocktake ${s.id}`,
                        },
                    });
                    yield tx.productVariants.update({
                        where: { id: line.variantId },
                        data: { stock: line.counted },
                    });
                }
            }));
            s.status = "posted";
            s.postedLines = snapshot;
            s.lines = [];
            yield writeSessions(sessions);
            res.redirect(`/admin/inventory-support#p-stock`);
        }
        catch (e) {
            console.error(e);
            res.status(500).send("Post stocktake error");
        }
    });
}
function deleteStocktake(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { sid } = req.params;
            const sessions = yield readSessions();
            const idx = sessions.findIndex((x) => x.id === sid);
            if (idx === -1)
                return res.status(404).send("Session not found");
            sessions.splice(idx, 1);
            yield writeSessions(sessions);
            res.redirect("/admin/inventory-support#p-stock");
        }
        catch (e) {
            console.error(e);
            res.status(500).send("Delete stocktake error");
        }
    });
}
function stocktakeJson(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { sid } = req.params;
            const sessions = yield readSessions();
            const s = sessions.find((x) => x.id === sid);
            if (!s)
                return res.status(404).json({ ok: false, error: "Session not found" });
            let lines = null;
            let postedLines = null;
            if (s.status === "reviewing" && ((_a = s.lines) === null || _a === void 0 ? void 0 : _a.length)) {
                lines = s.lines;
            }
            else if (s.status === "posted") {
                const snap = s.postedLines;
                if (snap === null || snap === void 0 ? void 0 : snap.length) {
                    postedLines = snap.map(r => {
                        var _a, _b, _c;
                        return ({
                            variantId: r.variantId || null,
                            productId: r.productId,
                            title: r.title,
                            systemOnHand: (_a = r.systemOnHand) !== null && _a !== void 0 ? _a : '-',
                            counted: (_b = r.counted) !== null && _b !== void 0 ? _b : '-',
                            delta: (_c = r.delta) !== null && _c !== void 0 ? _c : '-',
                        });
                    });
                }
                else {
                    const moves = yield database_1.default.inventoryMovements.findMany({
                        where: { note: `stocktake ${s.id}` },
                        select: {
                            variantId: true,
                            productId: true,
                            delta: true,
                            products: { select: { id: true, title: true } },
                        },
                        orderBy: { createdAt: "desc" },
                        take: 500,
                    });
                    postedLines = moves.map((m) => {
                        var _a;
                        return ({
                            variantId: m.variantId || null,
                            productId: m.productId,
                            title: ((_a = m.products) === null || _a === void 0 ? void 0 : _a.title) || m.productId,
                            systemOnHand: '-',
                            counted: '-',
                            delta: m.delta,
                        });
                    });
                }
            }
            res.json({ ok: true, session: s, lines, postedLines });
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ ok: false });
        }
    });
}
function bulkUpload(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const file = req.file;
            if (!(file === null || file === void 0 ? void 0 : file.buffer))
                return res.status(400).send("CSV not found");
            const text = file.buffer.toString("utf-8");
            const rows = parseCsvSimple(text);
            const header = rows.shift();
            if (!header)
                return res.status(400).send("Invalid CSV");
            const hmap = new Map(header.map((h, i) => [h.toLowerCase(), i]));
            function idx(name) {
                const i = hmap.get(name.toLowerCase());
                if (i == null)
                    throw new Error(`Missing column "${name}"`);
                return i;
            }
            const out = [];
            for (const r of rows) {
                if (!r.length)
                    continue;
                const productId = r[idx("productId")];
                const variantId = hmap.has("variantId") ? r[idx("variantId")] : null;
                const delta = Number(r[idx("delta")]);
                const reason = r[idx("reason")] || "manualAdjust";
                const note = hmap.has("note") ? r[idx("note")] : null;
                if (!productId || !Number.isFinite(delta))
                    continue;
                out.push({ productId, variantId, delta, reason, note });
            }
            bulkPreviewCache = out;
            return page(req, res);
        }
        catch (e) {
            console.error(e);
            res.status(500).send("Bulk upload error");
        }
    });
}
function quickCount(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { productId, variantId, counted } = req.body;
            const targetCount = Number(counted);
            if (!productId || !Number.isFinite(targetCount)) {
                return res.status(400).send("productId & counted are required");
            }
            const variant = variantId
                ? yield database_1.default.productVariants.findUnique({ where: { id: variantId } })
                : yield database_1.default.productVariants.findFirst({ where: { productId } });
            if (!variant)
                return res.status(404).send("Variant not found");
            const sys = variant.stock || 0;
            const delta = targetCount - sys;
            yield database_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                yield tx.inventoryMovements.create({
                    data: {
                        productId,
                        variantId: variant.id,
                        delta,
                        reason: "manualAdjust",
                        note: "quickCount",
                    },
                });
                yield tx.productVariants.update({
                    where: { id: variant.id },
                    data: { stock: targetCount },
                });
            }));
            res.redirect("/admin/inventory-support#p-stock");
        }
        catch (e) {
            console.error(e);
            res.status(500).send("Quick Count error");
        }
    });
}
function bulkCommit(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const lines = bulkPreviewCache || [];
            if (!lines.length)
                return res.status(400).send("No preview to commit");
            yield database_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                for (const r of lines) {
                    yield tx.inventoryMovements.create({
                        data: {
                            productId: r.productId,
                            variantId: r.variantId || null,
                            delta: r.delta,
                            reason: r.reason || "manualAdjust",
                            note: r.note || null,
                        },
                    });
                    if (r.variantId) {
                        yield tx.productVariants.update({
                            where: { id: r.variantId },
                            data: { stock: { increment: r.delta } },
                        });
                    }
                    else {
                        const first = yield tx.productVariants.findFirst({
                            where: { productId: r.productId },
                            select: { id: true },
                        });
                        if (first) {
                            yield tx.productVariants.update({
                                where: { id: first.id },
                                data: { stock: { increment: r.delta } },
                            });
                        }
                    }
                }
            }));
            bulkPreviewCache = null;
            res.redirect("/admin/inventory-support#p-bulk");
        }
        catch (e) {
            console.error(e);
            res.status(500).send("Bulk commit error");
        }
    });
}
function barcode(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { productId, variantId, type } = req.query;
            if (!productId)
                return res.status(400).send("productId required");
            const q = new URLSearchParams();
            q.set("productId", String(productId));
            if (variantId)
                q.set("variantId", String(variantId));
            q.set("type", String(type || "barcode"));
            const codeUrl = `/admin/inventory-support/barcode.svg?${q.toString()}`;
            const sessions = (yield readSessions()).slice(0, 10);
            const negative = yield database_1.default.productVariants.findMany({
                where: { stock: { lt: 0 } },
                select: { id: true, productId: true, stock: true },
            });
            res.render("admin/pages/inventory-support/helper", {
                title: "Inventory Support",
                active: "inventory-support",
                lowStock: [],
                sessions,
                bulkPreview: bulkPreviewCache,
                diagnostics: { negative, orphan: [] },
                barcodeUrl: codeUrl,
                helpers: { money: fmtMoney },
            });
        }
        catch (e) {
            console.error(e);
            res.status(500).send("Barcode page error");
        }
    });
}
function barcodeImage(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { productId, variantId, type, symbology } = req.query;
            if (!productId) {
                res.status(400).type("text/plain").send("productId required");
                return;
            }
            const label = variantId ? `${productId}-${variantId}` : `${productId}`;
            if (String(type) === "qr") {
                const svg = yield qrcode_1.default.toString(label, {
                    type: "svg",
                    errorCorrectionLevel: "M",
                    margin: 2,
                    scale: 6,
                });
                res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
                res.send(svg);
                return;
            }
            const bcid = String(symbology || "code128");
            const png = yield bwip_js_1.default.toBuffer({
                bcid,
                text: label,
                scale: 3,
                height: 12,
                includetext: true,
                textxalign: 'center',
                textsize: 10,
                paddingwidth: 10,
                paddingheight: 10,
                backgroundcolor: 'FFFFFF',
            });
            res.setHeader("Content-Type", "image/png");
            res.send(png);
        }
        catch (e) {
            console.error(e);
            res.status(500).type("text/plain").send("Barcode image error: " + ((e === null || e === void 0 ? void 0 : e.message) || e));
        }
    });
}
function exportCsv(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const range = String(req.query.range || "month");
            const { s, e } = getRange(range);
            const prods = yield database_1.default.products.findMany({
                where: { deleted: false },
                select: {
                    id: true,
                    title: true,
                    productVariants: { select: { id: true, stock: true } },
                },
            });
            const onHandMap = new Map();
            for (const p of prods) {
                onHandMap.set(p.id, p.productVariants.reduce((t, v) => t + (v.stock || 0), 0));
            }
            const reservedItems = yield database_1.default.order_items.findMany({
                where: {
                    orders: {
                        status: { in: ["pending", "paid", "shipped"] },
                        created_at: { gte: s, lt: e },
                    },
                },
                select: { product_id: true, quantity: true },
            });
            const reservedMap = new Map();
            for (const it of reservedItems) {
                reservedMap.set(it.product_id, (reservedMap.get(it.product_id) || 0) + (it.quantity || 0));
            }
            const completed = yield database_1.default.order_items.findMany({
                where: {
                    orders: { status: "completed", created_at: { gte: s, lt: e } },
                },
                select: { product_id: true, quantity: true, price: true },
            });
            const soldMap = new Map();
            const revenueMap = new Map();
            for (const it of completed) {
                soldMap.set(it.product_id, (soldMap.get(it.product_id) || 0) + (it.quantity || 0));
                revenueMap.set(it.product_id, (revenueMap.get(it.product_id) || 0) + Number(it.price || 0) * (it.quantity || 0));
            }
            const rows = [
                ["productId", "title", "onHand", "reserved", "sold", "revenue"],
            ];
            for (const p of prods) {
                rows.push([
                    p.id,
                    p.title,
                    onHandMap.get(p.id) || 0,
                    reservedMap.get(p.id) || 0,
                    soldMap.get(p.id) || 0,
                    revenueMap.get(p.id) || 0,
                ]);
            }
            const csv = toCsv(rows);
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", 'attachment; filename="inventory-export.csv"');
            res.send(csv);
        }
        catch (e) {
            console.error(e);
            res.status(500).send("Export CSV error");
        }
    });
}
function templateCsv(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const rows = [
                ["productId", "variantId", "delta", "reason", "note"],
                ["p_001", "pv_001", "10", "manualImport", "initial import"],
                ["p_002", "", "-3", "manualAdjust", "adjustment"],
            ];
            const csv = toCsv(rows);
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", 'attachment; filename="inventory-bulk-template.csv"');
            res.send(csv);
        }
        catch (e) {
            console.error(e);
            res.status(500).send("Template CSV error");
        }
    });
}
function diagnostics(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const negative = yield database_1.default.productVariants.findMany({
                where: { stock: { lt: 0 } },
                select: { id: true, productId: true, stock: true },
            });
            const orphan = [];
            res.json({ ok: true, negative, orphan });
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ ok: false });
        }
    });
}
function rebuildOnHand(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const sums = yield database_1.default.$queryRawUnsafe(`
      SELECT "variantId" AS variantId, COALESCE(SUM(delta),0)::int AS sum
      FROM "inventoryMovements"
      GROUP BY "variantId"
      `);
            yield database_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                for (const row of sums) {
                    const variantId = (_b = (_a = row.variantid) !== null && _a !== void 0 ? _a : row.variantId) !== null && _b !== void 0 ? _b : null;
                    if (!variantId)
                        continue;
                    const sum = Number(row.sum || 0);
                    yield tx.productVariants.update({
                        where: { id: variantId },
                        data: { stock: sum },
                    });
                }
            }));
            res.redirect("/admin/inventory-support");
        }
        catch (e) {
            console.error(e);
            res.status(500).send("Rebuild onHand error");
        }
    });
}
function lookup(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const q = String(req.query.q || "").trim();
            if (!q)
                return res.json({ ok: true, items: [] });
            const items = yield database_1.default.products.findMany({
                where: { deleted: false, title: { contains: q, mode: "insensitive" } },
                select: {
                    id: true,
                    title: true,
                    productVariants: { select: { id: true }, take: 1 },
                },
                take: 20,
                orderBy: { title: "asc" },
            });
            const rows = items.map((p) => {
                var _a, _b;
                return ({
                    productId: p.id,
                    title: p.title,
                    variantId: ((_b = (_a = p.productVariants) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.id) || null,
                });
            });
            res.json({ ok: true, items: rows });
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ ok: false });
        }
    });
}
