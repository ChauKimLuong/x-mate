import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const dashboard = async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || "ALL";

    // 1️⃣ Khoảng thời gian lọc
    const now = new Date();
    const start =
      period === "1M" ? new Date(now.setMonth(now.getMonth() - 1)) :
      period === "6M" ? new Date(now.setMonth(now.getMonth() - 6)) :
      period === "1Y" ? new Date(now.setFullYear(now.getFullYear() - 1)) :
      new Date(0);

    // 2️⃣ KPI
    const totalOrders = await prisma.orders.count({
      where: { createdAt: { gte: start } },
    });

    const deals = await prisma.coupons.count({
      where: { createdat: { gte: start } },
    });

    const newLeads = await prisma.users.count({
      where: { created_at: { gte: start } },
    });

    const bookedRevAgg = await prisma.orders.aggregate({
      _sum: { total: true },
      where: { status: "completed", createdAt: { gte: start } },
    });
    const bookedRev = Number(bookedRevAgg._sum.total || 0);

    // 3️⃣ Biểu đồ (Product Views / Added / Completed)
    const ordersMonthly = await prisma.$queryRawUnsafe<{ month: number; completed: number }[]>(`
      SELECT 
        EXTRACT(MONTH FROM "createdAt")::int AS month,
        COUNT(*)::int AS completed
      FROM "orders"
      WHERE "status" = 'completed' AND "createdAt" >= '${start.toISOString()}'
      GROUP BY month
      ORDER BY month;
    `);

    const addedMonthly = await prisma.$queryRawUnsafe<{ month: number; added: number }[]>(`
      SELECT 
        EXTRACT(MONTH FROM "createdAt")::int AS month,
        COUNT(*)::int AS added
      FROM "orderItems"
      WHERE "createdAt" >= '${start.toISOString()}'
      GROUP BY month
      ORDER BY month;
    `);

    const viewsMonthly = await prisma.$queryRawUnsafe<{ month: number; views: number }[]>(`
      SELECT 
        EXTRACT(MONTH FROM "createdAt")::int AS month,
        COALESCE(SUM("soldCount"),0)::int AS views
      FROM "products"
      WHERE "createdAt" >= '${start.toISOString()}'
      GROUP BY month
      ORDER BY month;
    `);

    // 4️⃣ Hợp dữ liệu
    const monthsSet = new Set([
      ...ordersMonthly.map(m => m.month),
      ...addedMonthly.map(m => m.month),
      ...viewsMonthly.map(m => m.month),
    ]);

    const monthly = [...monthsSet].sort((a, b) => a - b).map(month => ({
      month,
      views: viewsMonthly.find(m => m.month === month)?.views || 0,
      added: addedMonthly.find(m => m.month === month)?.added || 0,
      completed: ordersMonthly.find(m => m.month === month)?.completed || 0,
    }));

    // 5️⃣ Tính delta %
    const last = monthly[monthly.length - 1] || { views: 0, added: 0, completed: 0 };
    const prev = monthly[monthly.length - 2] || { views: 0, added: 0, completed: 0 };
    const deltas = {
      totalOrders: prev.completed ? ((last.completed - prev.completed) / prev.completed) * 100 : 0,
      deals: prev.added ? ((last.added - prev.added) / prev.added) * 100 : 0,
      newLeads: prev.views ? ((last.views - prev.views) / prev.views) * 100 : 0,
      bookedRev: +2.5,
    };

    // 6️⃣ Chuẩn bị dữ liệu cho Chart
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const labels = monthly.map(m => monthNames[m.month - 1]);
    const seriesViews = monthly.map(m => m.views);
    const seriesAdded = monthly.map(m => m.added);
    const seriesCompleted = monthly.map(m => m.completed);

    // 7️⃣ Render ra view
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
    });

  } catch (err) {
    console.error("❌ Error loading dashboard:", err);
    res.status(500).send("Error loading dashboard");
  }
};
