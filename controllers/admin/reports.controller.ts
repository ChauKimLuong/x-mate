
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
const prisma = new PrismaClient();

/* =======================================================
   📊 RENDER REVENUE REPORT PAGE
   ======================================================= */
export const revenueReport = async (req: Request, res: Response) => {
  try {
    const rawFrom = req.query.from ? new Date(req.query.from as string) : new Date("2025-01-01");
    const rawTo = req.query.to ? new Date(req.query.to as string) : new Date();
    const status = (req.query.status as string) || "All";

    // Normalize to [startOfDay(from), startOfDay(to)+1day) so the 'to' date is inclusive
    const from = new Date(rawFrom.getFullYear(), rawFrom.getMonth(), rawFrom.getDate());
    const toNext = new Date(rawTo.getFullYear(), rawTo.getMonth(), rawTo.getDate() + 1);

    const where: any = { created_at: { gte: from, lt: toNext } };
    if (status !== "All") {
      const s = status.toLowerCase();
      if (s === "processing") where.status = { in: ["paid", "shipped"] };
      else if (["completed", "cancelled", "paid", "shipped"].includes(s)) where.status = s;
    }

    // --- Lấy danh sách đơn hàng ---
    const orders = await prisma.orders.findMany({
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

    // --- Lấy danh sách user tương ứng ---
    const tokens = Array.from(new Set(orders.map(o => o.token_user).filter(Boolean) as string[]));
    const users = tokens.length
      ? await prisma.users.findMany({
          where: { token_user: { in: tokens } },
          select: { token_user: true, full_name: true, email: true },
        })
      : [];
    const userMap = new Map(users.map(u => [u.token_user, u]));

    // --- Tạo rows để render ---
    const rows = orders.map(o => {
      const user = o.token_user ? userMap.get(o.token_user) : undefined;
      return {
        id: o.id,
        createdAt: o.created_at,
        userName: user?.full_name || "Khách vãng lai",
        userEmail: user?.email || "-",
        total: Number(o.grand_total || 0),
        status: o.status,
      };
    });

    // --- Tính toán tổng doanh thu ---
    const totalRevenue = rows.reduce((sum, r) => sum + r.total, 0);
    const completed = rows.filter(r => r.status === "completed").length;
    const processing = rows.filter(r => ["paid", "shipped"].includes(r.status)).length;

    // --- Render ra trang view ---
    res.render("admin/pages/reports/revenue", {
      title: "Reports",
      active: "reports",
      from: from.toISOString().substring(0, 10),
      to: new Date(toNext.getTime() - 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
      status,
      orders: rows,
      totalRevenue,
      completed,
      processing,
      // placeholders for inventory
      categories: [],
      movements: [],
      totalProductTypes: 0,
      totalStockRemaining: 0,
      totalSold: 0,
    });
  } catch (err) {
    // console.error("❌ Revenue report error:", err);
    res.status(500).send("Error loading revenue report");
  }
};

/* =======================================================
   💾 EXPORT REVENUE TO EXCEL
   ======================================================= */
export const exportRevenueExcel = async (req: Request, res: Response) => {
  try {
    const rawFrom = req.query.from ? new Date(req.query.from as string) : new Date("2025-01-01");
    const rawTo = req.query.to ? new Date(req.query.to as string) : new Date();
    const status = (req.query.status as string) || "All";

    const from = new Date(rawFrom.getFullYear(), rawFrom.getMonth(), rawFrom.getDate());
    const toNext = new Date(rawTo.getFullYear(), rawTo.getMonth(), rawTo.getDate() + 1);

    const where: any = { created_at: { gte: from, lt: toNext } };
    if (status !== "All") {
      const s = status.toLowerCase();
      if (s === "processing") {
        where.status = { in: ["paid", "shipped"] };
      } else if (["completed", "cancelled", "paid", "shipped"].includes(s)) {
        where.status = s;
      }
    }

    // Lấy danh sách đơn hàng
    const orders = await prisma.orders.findMany({
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

    // Always allow export; if no data, export an empty sheet with headers

    // Lấy danh sách user tương ứng qua token_user
    const tokens = Array.from(new Set(orders.map(o => o.token_user).filter(Boolean) as string[]));
    const users = tokens.length
      ? await prisma.users.findMany({
          where: { token_user: { in: tokens } },
          select: { token_user: true, full_name: true, email: true },
        })
      : [];

    const userMap = new Map(users.map(u => [u.token_user, u]));

    // ✅ Tạo rows có đầy đủ user_name và user_email
    const rows = orders.map(o => {
      const user = o.token_user ? userMap.get(o.token_user) : undefined;
      return {
        id: o.id,
        created_at: o.created_at,
        user_name: user?.full_name || "Khách vãng lai",
        user_email: user?.email || "-",
        total_number: Number(o.grand_total || 0),
        status: o.status,
      };
    });

    // === Excel export ===
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Revenue Report");

    ws.columns = [
      { header: "Order ID", key: "id", width: 15 },
      { header: "Date", key: "date", width: 15 },
      { header: "Customer", key: "customer", width: 25 },
      { header: "Email", key: "email", width: 25 },
      { header: "Total (VND)", key: "total", width: 18 },
      { header: "Status", key: "status", width: 15 },
    ];

    // ✅ Ghi từng dòng
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

    const rawBuffer: any = await wb.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer);
    res.setHeader("Content-Disposition", "attachment; filename=revenue_report.xlsx");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (err) {
    // console.error("❌ Export revenue error:", err);
    res.status(500).send("Error exporting revenue Excel");
  }
};

/* =======================================================
   📦 INVENTORY REPORT
   ======================================================= */
export const inventoryReport = async (req: Request, res: Response) => {
  try {
    const fromInv = req.query.from ? new Date(req.query.from as string) : new Date("2025-01-01");
    const toInv   = req.query.to ? new Date(req.query.to as string)   : new Date();
    const catId   = (req.query.cat as string) || "All";

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

    // --- Danh mục ---
    const categories = await prisma.categories.findMany({
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    });

    // --- Lọc sản phẩm ---
    const whereProduct: any = {};
    if (catId !== "All") whereProduct.categoryId = catId;

    // --- Lấy danh sách sản phẩm + variant ---
    const products = await prisma.products.findMany({
      where: whereProduct,
      include: {
        categories: { select: { title: true } },
        productVariants: { select: { id: true, stock: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // --- Lấy danh sách orderItems trong khoảng thời gian ---
    const soldItems = await prisma.order_items.findMany({
      where: {
        created_at: { gte: fromInv, lte: toInv },
        orders: { status: { in: ["completed", "paid", "shipped"] } },
      },
      select: { product_id: true, quantity: true },
    });

    // Gom theo productId
    const soldMap = new Map<string, number>();
    soldItems.forEach(i => {
      soldMap.set(i.product_id, (soldMap.get(i.product_id) || 0) + i.quantity);
    });

    // --- Tạo bảng dữ liệu ---
    const rows = products.map(p => {
      const soldQty = soldMap.get(p.id) || 0;
      const stockQty = p.productVariants.reduce((s, v) => s + v.stock, 0);
      const dynamicStock = Math.max(stockQty - soldQty, 0);

      return {
        id: p.id,
        title: p.title,
        category: p.categories?.title || "-",
        stock: dynamicStock,
        sold: soldQty,
        createdAt: p.createdAt,
      };
    });

    // ✅ TÍNH KPI DỰA TRÊN DỮ LIỆU BẢNG rows
    const totalProductTypes   = rows.length;
    const totalStockRemaining = rows.reduce((sum, r) => sum + r.stock, 0);
    const totalSold           = rows.reduce((sum, r) => sum + r.sold, 0);

    // --- Render ---
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
      // placeholders for revenue
      orders: [],
      totalRevenue: 0,
      completed: 0,
      processing: 0,
    });
  } catch (err) {
    // console.error("❌ Inventory report error:", err);
    res.status(500).send("Error loading inventory report");
  }
};
/* =======================================================
   💾 EXPORT INVENTORY TO EXCEL
   ======================================================= */
export const exportInventoryExcel = async (req: Request, res: Response) => {
  try {
    const fromInv = req.query.from ? new Date(req.query.from as string) : new Date("2025-01-01");
    const toInv = req.query.to ? new Date(req.query.to as string) : new Date();
    const reason = (req.query.reason as string) || "All";

    const where: any = { createdAt: { gte: fromInv, lte: toInv } };
    if (reason !== "All") {
      const r = reason.toLowerCase();
      if (r === "orderplaced") where.reason = "orderPlaced";
      else if (r === "ordercancelled") where.reason = "orderCancelled";
    }

    const movements = await prisma.inventoryMovements.findMany({
      where,
      include: { products: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Always allow export; if no data, export an empty sheet with headers

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Inventory Report");

    ws.columns = [
      { header: "Product", key: "product", width: 30 },
      { header: "Reason", key: "reason", width: 20 },
      { header: "Change (±Qty)", key: "delta", width: 15 },
      { header: "Note", key: "note", width: 25 },
      { header: "Date", key: "date", width: 15 },
    ];

    movements.forEach(m =>
      ws.addRow({
        product: m.products?.title || "-",
        reason: m.reason,
        delta: m.delta,
        note: m.note || "",
        date: m.createdAt.toLocaleDateString("vi-VN"),
      })
    );

    const rawBuffer: any = await wb.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer);
    res.setHeader("Content-Disposition", "attachment; filename=inventory_report.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err) {
    // console.error("❌ Export inventory error:", err);
    res.status(500).send("Error exporting inventory Excel");
  }
};
