import { Request, Response } from "express";
import prisma from "../../config/database";

/** ===== Helper: format tiền ===== */
const fmtMoney = (n: number | bigint | any) =>
  `${(Number(n) || 0).toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
  })}`;

/** ===== Helper: chọn khoảng thời gian thống kê ===== */
function getRange(range?: string) {
  const now = new Date();
  const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
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
    s.setDate(s.getDate() - (dow - 1)); // Monday
    const e = new Date(s);
    e.setDate(e.getDate() + 7);
    return { s, e, label: "Tuần này" };
  }
  if (range === "year") {
    const s = new Date(now.getFullYear(), 0, 1);
    const e = new Date(now.getFullYear() + 1, 0, 1);
    return { s, e, label: "Năm nay" };
  }
  // default: tháng
  const s = new Date(now.getFullYear(), now.getMonth(), 1);
  const e = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { s, e, label: "Tháng này" };
}

/** ====== Controller chính: Inventory Dashboard ====== */
export const getInventory = async (req: Request, res: Response) => {
  try {
    const range = String(req.query.range || "month");
    const { s, e, label } = getRange(range);

    /** 1️⃣ Lấy danh sách sản phẩm & tồn kho thực tế */
    const products = await prisma.products.findMany({
      where: { deleted: false, status: "active" },
      select: {
        id: true,
        title: true,
        productVariants: {
          select: { id: true, stock: true },
        },
      },
    });

    // Tính tổng hàng tồn kho (onHand)
    const onHandMap = new Map<string, number>();
    let totalItems = 0,
      inStock = 0,
      outStock = 0;
    for (const p of products) {
      const onHand = p.productVariants.reduce((t, v) => t + (v.stock || 0), 0);
      onHandMap.set(p.id, onHand);
      totalItems += onHand;
      if (onHand > 0) inStock++;
      else outStock++;
    }

    /** 2️⃣ Lấy các đơn hàng đang xử lý (reserved) */
    const reservedItems = await prisma.order_items.findMany({
      where: {
        orders: {
          status: { in: ["pending", "paid", "shipped"] },
          created_at: { gte: s, lt: e },
        },
      },
      select: { product_id: true, quantity: true },
    });

    const reservedMap = new Map<string, number>();
    for (const it of reservedItems) {
      const key = it.product_id;
      reservedMap.set(key, (reservedMap.get(key) || 0) + (it.quantity || 0));
    }

    /** 3️⃣ Lấy các đơn hoàn thành (sold + revenue) */
    const completedItems = await prisma.order_items.findMany({
      where: {
        orders: { status: "completed", created_at: { gte: s, lt: e } },
      },
      select: { product_id: true, quantity: true, price: true },
    });

    const soldMap = new Map<string, number>();
    const revenueMap = new Map<string, number>();
    for (const it of completedItems) {
      const key = it.product_id;
      soldMap.set(key, (soldMap.get(key) || 0) + (it.quantity || 0));
      const rev = Number(it.price) * (it.quantity || 0);
      revenueMap.set(key, (revenueMap.get(key) || 0) + rev);
    }

    /** 4️⃣ KPIs tổng quan */
    const completedOrders = await prisma.orders.count({
      where: { status: "completed", created_at: { gte: s, lt: e } },
    });

    /** 5️⃣ Top sản phẩm sắp hết hàng (low stock) */
    const lowStock = products
      .map((p) => ({
        title: p.title,
        stock: onHandMap.get(p.id) || 0,
      }))
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10);

    /** 6️⃣ Top sản phẩm bán chạy (top selling) */
    const topSellingAgg = new Map<string, { title: string; sold: number }>();
    for (const it of completedItems) {
      const key = it.product_id;
      const curr = topSellingAgg.get(key)?.sold || 0;
      const prodTitle =
        products.find((p) => p.id === key)?.title || `Sản phẩm ${key}`;
      topSellingAgg.set(key, { title: prodTitle, sold: curr + (it.quantity || 0) });
    }
    const topSelling = Array.from(topSellingAgg.values())
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 10);

    /** 7️⃣ Tạo bảng chi tiết từng sản phẩm */
    const rows = products.map((p) => ({
      productId: p.id,
      title: p.title,
      onHand: onHandMap.get(p.id) || 0,
      reserved: reservedMap.get(p.id) || 0,
      sold: soldMap.get(p.id) || 0,
      revenue: revenueMap.get(p.id) || 0,
    }));

    /** 8️⃣ Render ra view admin */
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
  } catch (err) {
    console.error("❌ Inventory controller error:", err);
    res.status(500).send("Đã xảy ra lỗi khi tải dữ liệu kho hàng!");
  }
};
