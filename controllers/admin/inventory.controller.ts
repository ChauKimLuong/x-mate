import { Request, Response } from "express";
import prisma from "../../config/database";

const fmtMoney = (n: number) =>
  `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;

function getRange(range?: string) {
  const now = new Date();
  const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (range === "today") {
    const s = sod(now), e = new Date(s); e.setDate(e.getDate() + 1);
    return { s, e, label: "This Day" };
  }
  if (range === "week") {
    const d = new Date(now);
    const dow = d.getDay() || 7; // Sun=0 -> 7
    const s = sod(new Date(d)); s.setDate(s.getDate() - (dow - 1)); // Mon
    const e = new Date(s); e.setDate(e.getDate() + 7);
    return { s, e, label: "This Week" };
  }
  if (range === "year") {
    const s = new Date(now.getFullYear(), 0, 1);
    const e = new Date(now.getFullYear() + 1, 0, 1);
    return { s, e, label: "This Year" };
  }
  // default: month
  const s = new Date(now.getFullYear(), now.getMonth(), 1);
  const e = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { s, e, label: "This Month" };
}

export const getInventory = async (req: Request, res: Response) => {
  try {
    const range = String(req.query.range || "month");
    const { s, e, label } = getRange(range);

    // 1) Lấy sản phẩm + tồn kho (onHand) theo biến thể
    const prods = await prisma.products.findMany({
      where: { deleted: false },
      select: {
        id: true,
        title: true,
        productVariants: { select: { id: true, stock: true } },
      },
    });

    // Map onHand theo productId
    const onHandMap = new Map<string, number>();
    let totalItems = 0, inStock = 0, outStock = 0;

    for (const p of prods) {
      const onHand = p.productVariants.reduce((t, v) => t + (v.stock || 0), 0);
      onHandMap.set(p.id, onHand);
      totalItems += onHand;
      if (onHand > 0) inStock++; else outStock++;
    }

    // 2) Đơn theo range để tính reserved / sold / revenue
    // reserved: status IN ('pending','paid','shipped')
    const reservedItems = await prisma.orderItems.findMany({
      where: {
        orders: {
          status: { in: ["pending", "paid", "shipped"] },
          createdAt: { gte: s, lt: e },
        },
      },
      select: { productId: true, quantity: true },
    });

    const reservedMap = new Map<string, number>();
    for (const it of reservedItems) {
      const key = it.productId;
      reservedMap.set(key, (reservedMap.get(key) || 0) + (it.quantity || 0));
    }

    // sold & revenue: status = 'completed'
    const completedItems = await prisma.orderItems.findMany({
      where: {
        orders: { status: "completed", createdAt: { gte: s, lt: e } },
      },
      select: { productId: true, quantity: true, priceSnap: true },
    });

    const soldMap = new Map<string, number>();
    const revenueMap = new Map<string, number>();
    for (const it of completedItems) {
      const key = it.productId;
      soldMap.set(key, (soldMap.get(key) || 0) + (it.quantity || 0));
      const rev = (it.priceSnap || 0) * (it.quantity || 0);
      revenueMap.set(key, (revenueMap.get(key) || 0) + rev);
    }

    // 3) KPIs
    const completedOrders = await prisma.orders.count({
      where: { status: "completed", createdAt: { gte: s, lt: e } },
    });

    // 4) Low stock (Top 10) từ onHandMap
    const lowStock = prods
      .map(p => ({ title: p.title, stock: onHandMap.get(p.id) || 0 }))
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10);

    // 5) Top selling theo range (completed)
    const topSellingAgg = new Map<string, { title: string; sold: number }>();
    for (const it of completedItems) {
      const key = it.productId;
      const curr = topSellingAgg.get(key)?.sold || 0;
      topSellingAgg.set(key, { title: prods.find(p => p.id === key)?.title || key, sold: curr + (it.quantity || 0) });
    }
    const topSelling = Array.from(topSellingAgg.values())
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 10);

    // 6) Rows theo SẢN PHẨM (1 kho)
    const rows = prods.map(p => ({
      productId: p.id,
      title: p.title,
      onHand: onHandMap.get(p.id) || 0,
      reserved: reservedMap.get(p.id) || 0,
      sold: soldMap.get(p.id) || 0,
      revenue: revenueMap.get(p.id) || 0,
    }));

    res.render("admin/pages/inventory/list", { 
      title: "Inventory",
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
  } catch (err) {
    console.error(err);
    res.status(500).send("Inventory error");
  }
};
