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
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboard = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const dashboard = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const period = req.query.period || "ALL";
        const now = new Date();
        const start = period === "1M"
            ? new Date(now.setMonth(now.getMonth() - 1))
            : period === "6M"
                ? new Date(now.setMonth(now.getMonth() - 6))
                : period === "1Y"
                    ? new Date(now.setFullYear(now.getFullYear() - 1))
                    : new Date(0);
        const [totalOrders, deals, newLeads] = yield Promise.all([
            prisma.orders.count({ where: { created_at: { gte: start } } }),
            prisma.coupons.count({ where: { createdat: { gte: start } } }),
            prisma.users.count({ where: { created_at: { gte: start } } }),
        ]);
        const bookedRevAgg = yield prisma.orders.aggregate({
            _sum: { grand_total: true },
            where: { status: "completed", created_at: { gte: start } },
        });
        const bookedRev = Number(bookedRevAgg._sum.grand_total || 0);
        const ordersMonthly = yield prisma.$queryRawUnsafe(`
      SELECT 
        EXTRACT(MONTH FROM "created_at")::int AS month,
        COUNT(*)::int AS completed
      FROM "orders"
      WHERE "status" = 'completed' AND "created_at" >= '${start.toISOString()}'
      GROUP BY month
      ORDER BY month;
    `);
        const addedMonthly = yield prisma.$queryRawUnsafe(`
      SELECT 
        EXTRACT(MONTH FROM "created_at")::int AS month,
        COUNT(*)::int AS added
      FROM "order_items"
      WHERE "created_at" >= '${start.toISOString()}'
      GROUP BY month
      ORDER BY month;
    `);
        const viewsMonthly = yield prisma.$queryRawUnsafe(`
      SELECT 
        EXTRACT(MONTH FROM "createdAt")::int AS month,
        COALESCE(SUM("soldCount"), 0)::int AS views
      FROM "products"
      WHERE "createdAt" >= '${start.toISOString()}'
      GROUP BY month
      ORDER BY month;
    `);
        const monthsSet = new Set([
            ...ordersMonthly.map((m) => m.month),
            ...addedMonthly.map((m) => m.month),
            ...viewsMonthly.map((m) => m.month),
        ]);
        const monthly = [...monthsSet]
            .sort((a, b) => a - b)
            .map((month) => {
            var _a, _b, _c;
            return ({
                month,
                views: ((_a = viewsMonthly.find((m) => m.month === month)) === null || _a === void 0 ? void 0 : _a.views) || 0,
                added: ((_b = addedMonthly.find((m) => m.month === month)) === null || _b === void 0 ? void 0 : _b.added) || 0,
                completed: ((_c = ordersMonthly.find((m) => m.month === month)) === null || _c === void 0 ? void 0 : _c.completed) || 0,
            });
        });
        const last = monthly[monthly.length - 1] || {
            views: 0,
            added: 0,
            completed: 0,
        };
        const prev = monthly[monthly.length - 2] || {
            views: 0,
            added: 0,
            completed: 0,
        };
        const deltas = {
            totalOrders: prev.completed
                ? ((last.completed - prev.completed) / prev.completed) * 100
                : 0,
            deals: prev.added
                ? ((last.added - prev.added) / prev.added) * 100
                : 0,
            newLeads: prev.views
                ? ((last.views - prev.views) / prev.views) * 100
                : 0,
            bookedRev: +2.5,
        };
        const monthNames = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ];
        const labels = monthly.map((m) => monthNames[m.month - 1]);
        const seriesViews = monthly.map((m) => m.views);
        const seriesAdded = monthly.map((m) => m.added);
        const seriesCompleted = monthly.map((m) => m.completed);
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        dayStart.setDate(dayStart.getDate() - 29);
        const revenueDailyRaw = yield prisma.$queryRawUnsafe(`
      SELECT CAST(o."created_at" AS DATE) AS d,
             COALESCE(SUM(o."grand_total"), 0)::float AS revenue
      FROM "orders" o
      WHERE o."status" = 'completed' AND o."created_at" >= '${dayStart.toISOString()}'
      GROUP BY d
      ORDER BY d ASC
    `);
        const dayKeys = [];
        for (let i = 0; i < 30; i++) {
            const d = new Date(dayStart);
            d.setDate(dayStart.getDate() + i);
            dayKeys.push(d.toISOString().slice(0, 10));
        }
        const fmtDay = (iso) => {
            const d = new Date(iso + 'T00:00:00');
            return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        };
        const revMap = new Map();
        for (const r of revenueDailyRaw) {
            const key = typeof r.d === 'string'
                ? String(r.d).slice(0, 10)
                : new Date(r.d).toISOString().slice(0, 10);
            revMap.set(key, Math.round(Number(r.revenue || 0)));
        }
        const revenueDaily = {
            labels: dayKeys.map(fmtDay),
            values: dayKeys.map((k) => revMap.get(k) || 0),
        };
        const catRevRaw = yield prisma.$queryRawUnsafe(`
      SELECT c."title" AS category,
             COALESCE(SUM((oi."price" * oi."quantity")::numeric), 0)::float AS revenue
      FROM "order_items" oi
      JOIN "orders" o ON o."id" = oi."order_id"
      JOIN "products" p ON p."id" = oi."product_id"
      JOIN "categories" c ON c."id" = p."categoryId"
      WHERE o."status" = 'completed' AND o."created_at" >= '${start.toISOString()}'
      GROUP BY c."title"
      ORDER BY revenue DESC
      LIMIT 6
    `);
        const catRevenue = {
            labels: catRevRaw.map(r => r.category || 'Uncategorized'),
            values: catRevRaw.map(r => Math.round(Number(r.revenue || 0))),
        };
        const topProductsRaw = yield prisma.$queryRawUnsafe(`
      SELECT p."title" AS title, COALESCE(SUM(oi."quantity"),0)::int AS qty
      FROM "order_items" oi
      JOIN "orders" o ON o."id" = oi."order_id"
      JOIN "products" p ON p."id" = oi."product_id"
      WHERE o."created_at" >= '${start.toISOString()}'
      GROUP BY p."title"
      ORDER BY qty DESC
      LIMIT 5
    `);
        const topProducts = {
            labels: topProductsRaw.map(r => r.title || '-'),
            values: topProductsRaw.map(r => r.qty || 0),
        };
        res.render("admin/pages/dashboard/index", {
            title: "Dashboard",
            active: "overview",
            period,
            labels,
            seriesViews,
            seriesAdded,
            seriesCompleted,
            kpis: { totalOrders, deals, newLeads, bookedRev },
            deltas,
            revenueDaily,
            catRevenue,
            topProducts,
        });
    }
    catch (err) {
        console.error("❌ Error loading dashboard:", err);
        res.status(500).send("Error loading dashboard");
    }
});
exports.dashboard = dashboard;
