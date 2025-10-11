
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
const prisma = new PrismaClient();

/* =======================================================
   💰 REVENUE REPORT
   ======================================================= */
export const revenueReport = async (req: Request, res: Response) => {
  try {
    const from = req.query.from ? new Date(req.query.from as string) : new Date("2025-01-01");
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const status = (req.query.status as string) || "All";

    // Validate khoảng ngày
    if (from > to)
      return res.render("admin/pages/reports/revenue", {
        title: "Reports",
        active: "reports",
        errorRevenue: "⚠ Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc!",
        orders: [],
        movements: [],
      });

    // Lọc theo trạng thái
    const where: any = { createdAt: { gte: from, lte: to } };
    if (status !== "All") {
      const s = status.toLowerCase();
      if (s === "processing") {
        where.status = { in: ["paid", "shipped"] };
      } else if (["completed", "cancelled", "paid", "shipped"].includes(s)) {
        where.status = s;
      }
    }

    const orders = await prisma.orders.findMany({
      where,
      include: { users: true },
      orderBy: { createdAt: "desc" },
    });

    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const completed = orders.filter(o => o.status === "completed").length;
    const processing = orders.filter(o => ["paid", "shipped"].includes(o.status)).length;

    res.render("admin/pages/reports/revenue", {
      title: "Reports",
      active: "reports",
      from: from.toISOString().substring(0, 10),
      to: to.toISOString().substring(0, 10),
      status,
      orders,
      totalRevenue,
      completed,
      processing,
      // Data Inventory rỗng
      fromInv: "",
      toInv: "",
      reason: "",
      movements: [],
      totalAdjustments: 0,
      added: 0,
      removed: 0,
      onHand: 0,
    });
  } catch (err) {
    console.error("❌ Revenue report error:", err);
    res.status(500).send("Error loading revenue report");
  }
};

/* =======================================================
   💾 EXPORT REVENUE TO EXCEL
   ======================================================= */
export const exportRevenueExcel = async (req: Request, res: Response) => {
  try {
    const from = req.query.from ? new Date(req.query.from as string) : new Date("2025-01-01");
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const status = (req.query.status as string) || "All";

    const where: any = { createdAt: { gte: from, lte: to } };
    if (status !== "All") {
      const s = status.toLowerCase();
      if (s === "processing") {
        where.status = { in: ["paid", "shipped"] };
      } else if (["completed", "cancelled", "paid", "shipped"].includes(s)) {
        where.status = s;
      }
    }

    const orders = await prisma.orders.findMany({
      where,
      include: { users: true },
      orderBy: { createdAt: "desc" },
    });

    if (!orders.length) return res.status(400).send("Không có dữ liệu để xuất Excel!");

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

    orders.forEach(o =>
      ws.addRow({
        id: o.id,
        date: o.createdAt.toLocaleDateString("vi-VN"),
        customer: o.users?.full_name || "-",
        email: o.users?.email || "-",
        total: o.total.toLocaleString("vi-VN"),
        status: o.status,
      })
    );

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader("Content-Disposition", "attachment; filename=revenue_report.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err) {
    console.error("❌ Export revenue error:", err);
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
    const soldItems = await prisma.orderItems.findMany({
      where: {
        createdAt: { gte: fromInv, lte: toInv },
        orders: { status: { in: ["completed", "paid", "shipped"] } },
      },
      select: { productId: true, quantity: true },
    });

    // Gom theo productId
    const soldMap = new Map<string, number>();
    soldItems.forEach(i => {
      soldMap.set(i.productId, (soldMap.get(i.productId) || 0) + i.quantity);
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
    console.error("❌ Inventory report error:", err);
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

    if (!movements.length) return res.status(400).send("Không có dữ liệu để xuất Excel!");

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

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader("Content-Disposition", "attachment; filename=inventory_report.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err) {
    console.error("❌ Export inventory error:", err);
    res.status(500).send("Error exporting inventory Excel");
  }
};
