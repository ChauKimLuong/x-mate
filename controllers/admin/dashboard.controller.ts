import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * 📊 DASHBOARD CONTROLLER (compatible with new Prisma schema)
 */
export const dashboard = async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || "ALL";

    // 1️⃣ Xác định khoảng thời gian lọc
    const now = new Date();
    const start =
      period === "1M"
        ? new Date(now.setMonth(now.getMonth() - 1))
        : period === "6M"
          ? new Date(now.setMonth(now.getMonth() - 6))
          : period === "1Y"
            ? new Date(now.setFullYear(now.getFullYear() - 1))
            : new Date(0);

    // 2️⃣ KPI CƠ BẢN
    const [totalOrders, deals, newLeads] = await Promise.all([
      prisma.orders.count({ where: { created_at: { gte: start } } }),
      prisma.coupons.count({ where: { createdat: { gte: start } } }),
      prisma.users.count({ where: { created_at: { gte: start } } }),
    ]);

    // 3️⃣ Tổng doanh thu đã hoàn thành
    const bookedRevAgg = await prisma.orders.aggregate({
      _sum: { grand_total: true },
      where: { status: "completed", created_at: { gte: start } },
    });
    const bookedRev = Number(bookedRevAgg._sum.grand_total || 0);

    // 4️⃣ Truy vấn dữ liệu cho biểu đồ
    // --- Đơn hàng hoàn thành theo tháng
    const ordersMonthly = await prisma.$queryRawUnsafe<
      { month: number; completed: number }[]
    >(`
      SELECT 
        EXTRACT(MONTH FROM "created_at")::int AS month,
        COUNT(*)::int AS completed
      FROM "orders"
      WHERE "status" = 'completed' AND "created_at" >= '${start.toISOString()}'
      GROUP BY month
      ORDER BY month;
    `);

    // --- Sản phẩm bán ra theo tháng (order_items)
    const addedMonthly = await prisma.$queryRawUnsafe<
      { month: number; added: number }[]
    >(`
      SELECT 
        EXTRACT(MONTH FROM "created_at")::int AS month,
        COUNT(*)::int AS added
      FROM "order_items"
      WHERE "created_at" >= '${start.toISOString()}'
      GROUP BY month
      ORDER BY month;
    `);

    // --- Số lượt xem / bán (dựa theo soldCount của products)
    const viewsMonthly = await prisma.$queryRawUnsafe<
      { month: number; views: number }[]
    >(`
      SELECT 
        EXTRACT(MONTH FROM "createdAt")::int AS month,
        COALESCE(SUM("soldCount"), 0)::int AS views
      FROM "products"
      WHERE "createdAt" >= '${start.toISOString()}'
      GROUP BY month
      ORDER BY month;
    `);

    // 5️⃣ Gộp dữ liệu biểu đồ theo tháng
    const monthsSet = new Set([
      ...ordersMonthly.map((m) => m.month),
      ...addedMonthly.map((m) => m.month),
      ...viewsMonthly.map((m) => m.month),
    ]);

    const monthly = [...monthsSet]
      .sort((a, b) => a - b)
      .map((month) => ({
        month,
        views: viewsMonthly.find((m) => m.month === month)?.views || 0,
        added: addedMonthly.find((m) => m.month === month)?.added || 0,
        completed:
          ordersMonthly.find((m) => m.month === month)?.completed || 0,
      }));

    // 6️⃣ Tính % thay đổi (delta)
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
      bookedRev: +2.5, // giả định tạm cho hiển thị KPI
    };

    // 7️⃣ Chuẩn bị dữ liệu cho biểu đồ (Chart.js hoặc ApexChart)
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

    // 7b) Additional datasets for richer dashboard
    // Daily order status counts (last 30 days)
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - 29);

    // Daily revenue (completed) last 30 days
    const revenueDailyRaw = await prisma.$queryRawUnsafe<
      { d: string; revenue: number }[]
    >(`
      SELECT CAST(o."created_at" AS DATE) AS d,
             COALESCE(SUM(o."grand_total"), 0)::float AS revenue
      FROM "orders" o
      WHERE o."status" = 'completed' AND o."created_at" >= '${dayStart.toISOString()}'
      GROUP BY d
      ORDER BY d ASC
    `);

    const dayKeys: string[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(dayStart);
      d.setDate(dayStart.getDate() + i);
      dayKeys.push(d.toISOString().slice(0, 10));
    }
    const fmtDay = (iso: string) => {
      const d = new Date(iso + 'T00:00:00');
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
    // Normalize date key from DB (Date or string) to 'YYYY-MM-DD'
    const revMap = new Map<string, number>();
    for (const r of revenueDailyRaw) {
      const key = typeof (r as any).d === 'string'
        ? String((r as any).d).slice(0, 10)
        : new Date((r as any).d).toISOString().slice(0, 10);
      revMap.set(key, Math.round(Number((r as any).revenue || 0)));
    }
    const revenueDaily = {
      labels: dayKeys.map(fmtDay),
      values: dayKeys.map((k) => revMap.get(k) || 0),
    };

    // Revenue by category (top 6)
    const catRevRaw = await prisma.$queryRawUnsafe<
      { category: string; revenue: number }[]
    >(`
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

    // (Removed) Payment method distribution per request

    // Top 5 products by quantity sold
    const topProductsRaw = await prisma.$queryRawUnsafe<
      { title: string; qty: number }[]
    >(`
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

    // 8️⃣ Render ra trang dashboard
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
  } catch (err) {
    console.error("❌ Error loading dashboard:", err);
    res.status(500).send("Error loading dashboard");
  }
};
