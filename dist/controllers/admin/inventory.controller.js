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
exports.getInventory = void 0;
const database_1 = __importDefault(require("../../config/database"));
const fmtMoney = (n) => `${(Number(n) || 0).toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
})}`;
function getRange(range) {
    const now = new Date();
    const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (range === "today") {
        const s = sod(now);
        const e = new Date(s);
        e.setDate(e.getDate() + 1);
        return { s, e, label: "Hôm nay" };
    }
    if (range === "week") {
        const d = new Date(now);
        const dow = d.getDay() || 7;
        const s = sod(new Date(d));
        s.setDate(s.getDate() - (dow - 1));
        const e = new Date(s);
        e.setDate(e.getDate() + 7);
        return { s, e, label: "Tuần này" };
    }
    if (range === "year") {
        const s = new Date(now.getFullYear(), 0, 1);
        const e = new Date(now.getFullYear() + 1, 0, 1);
        return { s, e, label: "Năm nay" };
    }
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { s, e, label: "Tháng này" };
}
const getInventory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const range = String(req.query.range || "month");
        const { s, e, label } = getRange(range);
        const products = yield database_1.default.products.findMany({
            where: { deleted: false, status: "active" },
            select: {
                id: true,
                title: true,
                productVariants: {
                    select: { id: true, stock: true },
                },
            },
        });
        const onHandMap = new Map();
        let totalItems = 0, inStock = 0, outStock = 0;
        for (const p of products) {
            const onHand = p.productVariants.reduce((t, v) => t + (v.stock || 0), 0);
            onHandMap.set(p.id, onHand);
            totalItems += onHand;
            if (onHand > 0)
                inStock++;
            else
                outStock++;
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
            const key = it.product_id;
            reservedMap.set(key, (reservedMap.get(key) || 0) + (it.quantity || 0));
        }
        const completedItems = yield database_1.default.order_items.findMany({
            where: {
                orders: { status: "completed", created_at: { gte: s, lt: e } },
            },
            select: { product_id: true, quantity: true, price: true },
        });
        const soldMap = new Map();
        const revenueMap = new Map();
        for (const it of completedItems) {
            const key = it.product_id;
            soldMap.set(key, (soldMap.get(key) || 0) + (it.quantity || 0));
            const rev = Number(it.price) * (it.quantity || 0);
            revenueMap.set(key, (revenueMap.get(key) || 0) + rev);
        }
        const completedOrders = yield database_1.default.orders.count({
            where: { status: "completed", created_at: { gte: s, lt: e } },
        });
        const lowStock = products
            .map((p) => ({
            title: p.title,
            stock: onHandMap.get(p.id) || 0,
        }))
            .sort((a, b) => a.stock - b.stock)
            .slice(0, 10);
        const topSellingAgg = new Map();
        for (const it of completedItems) {
            const key = it.product_id;
            const curr = ((_a = topSellingAgg.get(key)) === null || _a === void 0 ? void 0 : _a.sold) || 0;
            const prodTitle = ((_b = products.find((p) => p.id === key)) === null || _b === void 0 ? void 0 : _b.title) || `Sản phẩm ${key}`;
            topSellingAgg.set(key, { title: prodTitle, sold: curr + (it.quantity || 0) });
        }
        const topSelling = Array.from(topSellingAgg.values())
            .sort((a, b) => b.sold - a.sold)
            .slice(0, 10);
        const rows = products.map((p) => ({
            productId: p.id,
            title: p.title,
            onHand: onHandMap.get(p.id) || 0,
            reserved: reservedMap.get(p.id) || 0,
            sold: soldMap.get(p.id) || 0,
            revenue: revenueMap.get(p.id) || 0,
        }));
        res.render("admin/pages/inventory/list", {
            title: "Quản lý tồn kho",
            active: "inventory",
            range,
            filterLabel: label,
            kpis: {
                totalProductItems: totalItems,
                inStockProduct: inStock,
                outOfStockProduct: outStock,
                completedOrders,
            },
            rows,
            lowStock,
            topSelling,
            helpers: { money: fmtMoney },
        });
    }
    catch (err) {
        console.error("❌ Inventory controller error:", err);
        res.status(500).send("Đã xảy ra lỗi khi tải dữ liệu kho hàng!");
    }
});
exports.getInventory = getInventory;
