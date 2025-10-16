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
exports.exportInventoryExcel = exports.inventoryReport = exports.exportRevenueExcel = exports.revenueReport = void 0;
const client_1 = require("@prisma/client");
const exceljs_1 = __importDefault(require("exceljs"));
const prisma = new client_1.PrismaClient();
const revenueReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const from = req.query.from ? new Date(req.query.from) : new Date("2025-01-01");
        const to = req.query.to ? new Date(req.query.to) : new Date();
        const status = req.query.status || "All";
        const where = { created_at: { gte: from, lte: to } };
        if (status !== "All") {
            const s = status.toLowerCase();
            if (s === "processing")
                where.status = { in: ["paid", "shipped"] };
            else if (["completed", "cancelled", "paid", "shipped"].includes(s))
                where.status = s;
        }
        const orders = yield prisma.orders.findMany({
            where,
            orderBy: { created_at: "desc" },
            select: {
                id: true,
                status: true,
                grand_total: true,
                created_at: true,
                token_user: true,
            },
        });
        const tokens = Array.from(new Set(orders.map(o => o.token_user).filter(Boolean)));
        const users = tokens.length
            ? yield prisma.users.findMany({
                where: { token_user: { in: tokens } },
                select: { token_user: true, full_name: true, email: true },
            })
            : [];
        const userMap = new Map(users.map(u => [u.token_user, u]));
        const rows = orders.map(o => {
            const user = o.token_user ? userMap.get(o.token_user) : undefined;
            return {
                id: o.id,
                createdAt: o.created_at,
                userName: (user === null || user === void 0 ? void 0 : user.full_name) || "Khách vãng lai",
                userEmail: (user === null || user === void 0 ? void 0 : user.email) || "-",
                total: Number(o.grand_total || 0),
                status: o.status,
            };
        });
        const totalRevenue = rows.reduce((sum, r) => sum + r.total, 0);
        const completed = rows.filter(r => r.status === "completed").length;
        const processing = rows.filter(r => ["paid", "shipped"].includes(r.status)).length;
        res.render("admin/pages/reports/revenue", {
            title: "Reports",
            active: "reports",
            from: from.toISOString().substring(0, 10),
            to: to.toISOString().substring(0, 10),
            status,
            orders: rows,
            totalRevenue,
            completed,
            processing,
            categories: [],
            movements: [],
            totalProductTypes: 0,
            totalStockRemaining: 0,
            totalSold: 0,
        });
    }
    catch (err) {
        res.status(500).send("Error loading revenue report");
    }
});
exports.revenueReport = revenueReport;
const exportRevenueExcel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const from = req.query.from ? new Date(req.query.from) : new Date("2025-01-01");
        const to = req.query.to ? new Date(req.query.to) : new Date();
        const status = req.query.status || "All";
        const where = { created_at: { gte: from, lte: to } };
        if (status !== "All") {
            const s = status.toLowerCase();
            if (s === "processing") {
                where.status = { in: ["paid", "shipped"] };
            }
            else if (["completed", "cancelled", "paid", "shipped"].includes(s)) {
                where.status = s;
            }
        }
        const orders = yield prisma.orders.findMany({
            where,
            orderBy: { created_at: "desc" },
            select: {
                id: true,
                status: true,
                grand_total: true,
                created_at: true,
                token_user: true,
            },
        });
        if (!orders.length)
            return res.status(400).send("Không có dữ liệu để xuất Excel!");
        const tokens = Array.from(new Set(orders.map(o => o.token_user).filter(Boolean)));
        const users = tokens.length
            ? yield prisma.users.findMany({
                where: { token_user: { in: tokens } },
                select: { token_user: true, full_name: true, email: true },
            })
            : [];
        const userMap = new Map(users.map(u => [u.token_user, u]));
        const rows = orders.map(o => {
            const user = o.token_user ? userMap.get(o.token_user) : undefined;
            return {
                id: o.id,
                created_at: o.created_at,
                user_name: (user === null || user === void 0 ? void 0 : user.full_name) || "Khách vãng lai",
                user_email: (user === null || user === void 0 ? void 0 : user.email) || "-",
                total_number: Number(o.grand_total || 0),
                status: o.status,
            };
        });
        const wb = new exceljs_1.default.Workbook();
        const ws = wb.addWorksheet("Revenue Report");
        ws.columns = [
            { header: "Order ID", key: "id", width: 15 },
            { header: "Date", key: "date", width: 15 },
            { header: "Customer", key: "customer", width: 25 },
            { header: "Email", key: "email", width: 25 },
            { header: "Total (VND)", key: "total", width: 18 },
            { header: "Status", key: "status", width: 15 },
        ];
        rows.forEach(o => {
            ws.addRow({
                id: o.id,
                date: new Date(o.created_at).toLocaleDateString("vi-VN"),
                customer: o.user_name,
                email: o.user_email,
                total: o.total_number.toLocaleString("vi-VN"),
                status: o.status,
            });
        });
        const buffer = yield wb.xlsx.writeBuffer();
        res.setHeader("Content-Disposition", "attachment; filename=revenue_report.xlsx");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.send(buffer);
    }
    catch (err) {
        res.status(500).send("Error exporting revenue Excel");
    }
});
exports.exportRevenueExcel = exportRevenueExcel;
const inventoryReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const fromInv = req.query.from ? new Date(req.query.from) : new Date("2025-01-01");
        const toInv = req.query.to ? new Date(req.query.to) : new Date();
        const catId = req.query.cat || "All";
        if (fromInv > toInv) {
            return res.render("admin/pages/reports/revenue", {
                title: "Reports",
                active: "reports",
                errorInventory: "⚠ Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc!",
                fromInv: fromInv.toISOString().substring(0, 10),
                toInv: toInv.toISOString().substring(0, 10),
                catId,
                categories: [],
                movements: [],
                totalProductTypes: 0,
                totalStockRemaining: 0,
                totalSold: 0,
                orders: [], totalRevenue: 0, completed: 0, processing: 0,
            });
        }
        const categories = yield prisma.categories.findMany({
            select: { id: true, title: true },
            orderBy: { title: "asc" },
        });
        const whereProduct = {};
        if (catId !== "All")
            whereProduct.categoryId = catId;
        const products = yield prisma.products.findMany({
            where: whereProduct,
            include: {
                categories: { select: { title: true } },
                productVariants: { select: { id: true, stock: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        const soldItems = yield prisma.order_items.findMany({
            where: {
                created_at: { gte: fromInv, lte: toInv },
                orders: { status: { in: ["completed", "paid", "shipped"] } },
            },
            select: { product_id: true, quantity: true },
        });
        const soldMap = new Map();
        soldItems.forEach(i => {
            soldMap.set(i.product_id, (soldMap.get(i.product_id) || 0) + i.quantity);
        });
        const rows = products.map(p => {
            var _a;
            const soldQty = soldMap.get(p.id) || 0;
            const stockQty = p.productVariants.reduce((s, v) => s + v.stock, 0);
            const dynamicStock = Math.max(stockQty - soldQty, 0);
            return {
                id: p.id,
                title: p.title,
                category: ((_a = p.categories) === null || _a === void 0 ? void 0 : _a.title) || "-",
                stock: dynamicStock,
                sold: soldQty,
                createdAt: p.createdAt,
            };
        });
        const totalProductTypes = rows.length;
        const totalStockRemaining = rows.reduce((sum, r) => sum + r.stock, 0);
        const totalSold = rows.reduce((sum, r) => sum + r.sold, 0);
        res.render("admin/pages/reports/revenue", {
            title: "Reports",
            active: "reports",
            fromInv: fromInv.toISOString().substring(0, 10),
            toInv: toInv.toISOString().substring(0, 10),
            catId,
            categories,
            movements: rows,
            totalProductTypes,
            totalStockRemaining,
            totalSold,
            orders: [],
            totalRevenue: 0,
            completed: 0,
            processing: 0,
        });
    }
    catch (err) {
        res.status(500).send("Error loading inventory report");
    }
});
exports.inventoryReport = inventoryReport;
const exportInventoryExcel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const fromInv = req.query.from ? new Date(req.query.from) : new Date("2025-01-01");
        const toInv = req.query.to ? new Date(req.query.to) : new Date();
        const reason = req.query.reason || "All";
        const where = { createdAt: { gte: fromInv, lte: toInv } };
        if (reason !== "All") {
            const r = reason.toLowerCase();
            if (r === "orderplaced")
                where.reason = "orderPlaced";
            else if (r === "ordercancelled")
                where.reason = "orderCancelled";
        }
        const movements = yield prisma.inventoryMovements.findMany({
            where,
            include: { products: { select: { title: true } } },
            orderBy: { createdAt: "desc" },
        });
        if (!movements.length)
            return res.status(400).send("Không có dữ liệu để xuất Excel!");
        const wb = new exceljs_1.default.Workbook();
        const ws = wb.addWorksheet("Inventory Report");
        ws.columns = [
            { header: "Product", key: "product", width: 30 },
            { header: "Reason", key: "reason", width: 20 },
            { header: "Change (±Qty)", key: "delta", width: 15 },
            { header: "Note", key: "note", width: 25 },
            { header: "Date", key: "date", width: 15 },
        ];
        movements.forEach(m => {
            var _a;
            return ws.addRow({
                product: ((_a = m.products) === null || _a === void 0 ? void 0 : _a.title) || "-",
                reason: m.reason,
                delta: m.delta,
                note: m.note || "",
                date: m.createdAt.toLocaleDateString("vi-VN"),
            });
        });
        const buffer = yield wb.xlsx.writeBuffer();
        res.setHeader("Content-Disposition", "attachment; filename=inventory_report.xlsx");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.send(buffer);
    }
    catch (err) {
        res.status(500).send("Error exporting inventory Excel");
    }
});
exports.exportInventoryExcel = exportInventoryExcel;
