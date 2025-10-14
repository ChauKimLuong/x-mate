// controllers/admin/inventorySupport.controller.ts
import { Request, Response } from "express";
import prisma from "../../config/database";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import bwipjs from "bwip-js";
import QRCode from "qrcode";


/** ========= Helpers ========= */

const DATA_DIR = path.join(process.cwd(), "data");
const SESS_FILE = path.join(DATA_DIR, "stocktake-sessions.json");

type StocktakeStatus = "draft" | "reviewing" | "posted";
type StocktakeLine = {
  variantId: string;
  productId: string;
  title: string;
  systemOnHand: number;
  counted: number | null;
  delta: number | null;
};
type StocktakeSession = {
  id: string;
  name: string;
  status: StocktakeStatus;
  createdAt: string; // ISO
  scope: "all" | "active" | "low";
  lines?: StocktakeLine[]; // only when reviewing
};

async function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) await fsp.mkdir(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SESS_FILE)) await fsp.writeFile(SESS_FILE, "[]", "utf-8");
}

async function readSessions(): Promise<StocktakeSession[]> {
  await ensureDataDir();
  const raw = await fsp.readFile(SESS_FILE, "utf-8");
  try {
    return JSON.parse(raw) as StocktakeSession[];
  } catch {
    return [];
  }
}

async function writeSessions(arr: StocktakeSession[]) {
  await ensureDataDir();
  await fsp.writeFile(SESS_FILE, JSON.stringify(arr, null, 2), "utf-8");
}

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

const fmtMoney = (n: number) =>
  `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;

// super-naive CSV parser (no quotes support) — đủ dùng cho template của mình
function parseCsvSimple(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(",").map((x) => x.trim()));
}

function toCsv(rows: (string | number | null | undefined)[][]): string {
  const safe = (v: any) => {
    const s = (v ?? "").toString();
    // wrap if contains comma/quote/newline
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(safe).join(",")).join("\n");
}

// cache preview bulk (dev-friendly)
let bulkPreviewCache:
  | { productId: string; variantId?: string | null; delta: number; reason: string; note?: string | null }[]
  | null = null;

/** ========= Page ========= */

export async function page(req: Request, res: Response) {
  try {
    const sessions = (await readSessions())
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 10);

    // low-stock: top 10 theo onHand (dùng cột stock hiện tại)
    const products = await prisma.products.findMany({
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

    // diagnostics
    const negative = await prisma.productVariants.findMany({
      where: { stock: { lt: 0 } },
      select: { id: true, productId: true, stock: true },
    });
    // Orphan (variants without product) — trong Prisma đã có relation bắt buộc; phòng hờ:
    const orphan: { id: string }[] = [];

    res.render("admin/pages/inventory-support/helper", {
      title: "Inventory Support",
      active: "inventory-support",
      lowStock,
      sessions,
      bulkPreview: bulkPreviewCache,
      diagnostics: { negative, orphan },
      barcodeUrl: undefined,
      helpers: { money: fmtMoney },
    });
  } catch (e) {
    console.error(e);
    res.status(500).send("InventorySupport page error");
  }
}

/** ========= Low-Stock JSON ========= */
export async function lowStock(req: Request, res: Response) {
  try {
    const limit = Math.min(Number(req.query.limit || 10), 200);
    const products = await prisma.products.findMany({
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
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
}

/** ========= Reorder Draft CSV ========= */
export async function reorderDraftCsv(req: Request, res: Response) {
  try {
    const products = await prisma.products.findMany({
      where: { deleted: false, status: "active" },
      select: {
        id: true,
        title: true,
        productVariants: { select: { stock: true } },
      },
    });
    const rows = [["productId", "title", "onHand", "reorderPoint", "suggestQty"]];
    products.forEach((p) => {
      const onHand = p.productVariants.reduce((s, v) => s + (v.stock || 0), 0);
      const rp = 10;
      const suggest = Math.max(0, rp - onHand);
      if (suggest > 0) rows.push([p.id, p.title, onHand, rp, suggest]);
    });
    const csv = toCsv(rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="reorder-draft.csv"');
    res.send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).send("Cannot create draft PO");
  }
}

/** ========= Stocktake ========= */

// Create session
export async function createStocktake(req: Request, res: Response) {
  try {
    const { name, scope } = req.body as { name: string; scope: "all" | "active" | "low" };
    const sess: StocktakeSession = {
      id: uuidv4(),
      name: name?.trim() || `Stocktake ${dayjs().format("YYYY-MM-DD HH:mm")}`,
      status: "draft",
      scope: scope || "all",
      createdAt: new Date().toISOString(),
    };
    const arr = await readSessions();
    arr.push(sess);
    await writeSessions(arr);
    res.redirect("/admin/inventory-support#p-stock");
  } catch (e) {
    console.error(e);
    res.status(500).send("Create stocktake error");
  }
}

// View a session
export async function viewStocktake(req: Request, res: Response) {
  try {
    const { sid } = req.params;
    const sessions = await readSessions();
    const s = sessions.find((x) => x.id === sid);
    if (!s) return res.status(404).send("Session not found");

    // Render the helper page but focus stock tab; include this one session at top of list
    const products = await prisma.products.findMany({
      where: { deleted: false, status: "active" },
      select: { id: true, title: true, productVariants: { select: { id: true, stock: true } } },
    });
    const lowStock = products
      .map((p) => ({ title: p.title, stock: p.productVariants.reduce((a, b) => a + b.stock, 0), reorderPoint: 10 }))
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10);

    const negative = await prisma.productVariants.findMany({
      where: { stock: { lt: 0 } },
      select: { id: true, productId: true, stock: true },
    });

    res.render("admin/pages/inventory-support/helper", {
      title: "Inventory Support",
      active: "inventory-support",
      lowStock,
      sessions: [s, ...sessions.filter((x) => x.id !== sid)].slice(0, 10),
      bulkPreview: bulkPreviewCache,
      diagnostics: { negative, orphan: [] },
      barcodeUrl: undefined,
      helpers: { money: fmtMoney },
    });
  } catch (e) {
    console.error(e);
    res.status(500).send("View stocktake error");
  }
}

// Download CSV template for a session
export async function downloadStocktake(req: Request, res: Response) {
  try {
    const { sid } = req.params;
    const sessions = await readSessions();
    const s = sessions.find((x) => x.id === sid);
    if (!s) return res.status(404).send("Session not found");

    // Build rows: variant-level
    const variants = await prisma.productVariants.findMany({
      select: {
        id: true,
        stock: true,
        products: { select: { id: true, title: true, status: true, deleted: true } },
      },
    });

    // scope filter
    const rows = [["variantId", "productId", "title", "systemOnHand", "counted"]];
    for (const v of variants) {
      const prod = v.products;
      if (!prod) continue;
      if (s.scope === "active" && (prod.deleted || prod.status !== "active")) continue;

      const on = v.stock || 0;

      if (s.scope === "low") {
        const rp = 10;
        if (on > rp) continue;
      }
      rows.push([v.id, prod.id, prod.title, on, ""]);
    }

    const csv = toCsv(rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="stocktake-${sid}.csv"`);
    res.send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).send("Download stocktake error");
  }
}

// Upload stocktake CSV → preview (session moves to reviewing)
export async function uploadStocktakeCsv(req: Request, res: Response) {
  try {
    const { sid } = req.params;
    const sessions = await readSessions();
    const s = sessions.find((x) => x.id === sid);
    if (!s) return res.status(404).send("Session not found");

    // Expect multer puts file buffer at (req as any).file.buffer
    const file = (req as any).file;
    if (!file?.buffer) return res.status(400).send("CSV not found");

    const text = file.buffer.toString("utf-8");
    const rows = parseCsvSimple(text);
    const header = rows.shift();
    if (!header || header[0] !== "variantId") return res.status(400).send("Invalid CSV");

    const byVariant = new Map<string, number>(); // counted
    for (const r of rows) {
      const variantId = r[0];
      const counted = Number(r[4] ?? r[3] ?? ""); // accept formats
      if (variantId) byVariant.set(variantId, Number.isFinite(counted) ? counted : NaN);
    }

    const variants = await prisma.productVariants.findMany({
      where: { id: { in: Array.from(byVariant.keys()) } },
      select: { id: true, stock: true, products: { select: { id: true, title: true } } },
    });

    const preview: StocktakeLine[] = variants.map((v) => {
      const counted = byVariant.get(v.id);
      const sys = v.stock || 0;
      const delta = Number.isFinite(counted!) ? counted! - sys : null;
      return {
        variantId: v.id,
        productId: v.products?.id || "",
        title: v.products?.title || v.id,
        systemOnHand: sys,
        counted: Number.isFinite(counted!) ? counted! : null,
        delta,
      };
    });

    s.status = "reviewing";
    s.lines = preview;
    await writeSessions(sessions);

    res.redirect(`/admin/inventory-support#p-stock`);
  } catch (e) {
    console.error(e);
    res.status(500).send("Upload stocktake error");
  }
}

// Post stocktake (commit deltas)
export async function postStocktake(req: Request, res: Response) {
  try {
    const { sid } = req.params;
    const sessions = await readSessions();
    const s = sessions.find((x) => x.id === sid);
    if (!s) return res.status(404).send("Session not found");
    if (s.status !== "reviewing" || !s.lines?.length) {
      return res.status(400).send("Session not in reviewing or no lines");
    }

    await prisma.$transaction(async (tx) => {
      for (const line of s.lines!) {
        if (line.counted == null || line.delta == null || line.delta === 0) continue;

        // create movement
        await tx.inventoryMovements.create({
          data: {
            productId: line.productId,
            variantId: line.variantId,
            delta: line.delta,
            reason: "manualAdjust",
            note: `stocktake ${s.id}`,
          },
        });

        // sync variant stock to counted
        await tx.productVariants.update({
          where: { id: line.variantId },
          data: { stock: line.counted },
        });
      }
    });

    s.status = "posted";
    s.lines = [];
    await writeSessions(sessions);
    res.redirect(`/admin/inventory-support#p-stock`);
  } catch (e) {
    console.error(e);
    res.status(500).send("Post stocktake error");
  }
}
// Delete a stocktake session
export async function deleteStocktake(req: Request, res: Response) {
  try {
    const { sid } = req.params;
    const sessions = await readSessions();
    const idx = sessions.findIndex((x) => x.id === sid);
    if (idx === -1) return res.status(404).send("Session not found");

    // Lưu ý: việc xóa này chỉ xóa metadata trong file JSON của stocktake,
    // không ảnh hưởng các movement đã POST trước đó.
    sessions.splice(idx, 1);
    await writeSessions(sessions);

    res.redirect("/admin/inventory-support#p-stock");
  } catch (e) {
    console.error(e);
    res.status(500).send("Delete stocktake error");
  }
}


/** ========= Bulk Adjust ========= */

// Upload CSV -> preview (cache in memory)
export async function bulkUpload(req: Request, res: Response) {
  try {
    const file = (req as any).file;
    if (!file?.buffer) return res.status(400).send("CSV not found");
    const text = file.buffer.toString("utf-8");
    const rows = parseCsvSimple(text);
    const header = rows.shift();
    if (!header) return res.status(400).send("Invalid CSV");
    // expected: productId, variantId(optional), delta, reason, note(optional)
    const hmap = new Map(header.map((h, i) => [h.toLowerCase(), i]));
    function idx(name: string) {
      const i = hmap.get(name.toLowerCase());
      if (i == null) throw new Error(`Missing column "${name}"`);
      return i;
    }
    const out: { productId: string; variantId?: string | null; delta: number; reason: string; note?: string | null }[] = [];
    for (const r of rows) {
      if (!r.length) continue;
      const productId = r[idx("productId")];
      const variantId = hmap.has("variantId") ? r[idx("variantId")] : null;
      const delta = Number(r[idx("delta")]);
      const reason = r[idx("reason")] || "manualAdjust";
      const note = hmap.has("note") ? r[idx("note")] : null;
      if (!productId || !Number.isFinite(delta)) continue;
      out.push({ productId, variantId, delta, reason, note });
    }
    bulkPreviewCache = out;

    // render page with preview
    return page(req, res);
  } catch (e) {
    console.error(e);
    res.status(500).send("Bulk upload error");
  }
}
export async function quickCount(req: Request, res: Response) {
  try {
    const { productId, variantId, counted } = req.body as {
      productId: string;
      variantId?: string;
      counted: string | number;
    };
    const targetCount = Number(counted);
    if (!productId || !Number.isFinite(targetCount)) {
      return res.status(400).send("productId & counted are required");
    }

    // Lấy variant: ưu tiên variantId, nếu không có thì lấy variant đầu tiên của product
    const variant =
      variantId
        ? await prisma.productVariants.findUnique({ where: { id: variantId } })
        : await prisma.productVariants.findFirst({ where: { productId } });

    if (!variant) return res.status(404).send("Variant not found");

    const sys = variant.stock || 0;
    const delta = targetCount - sys;

    await prisma.$transaction(async (tx) => {
      // movement để trace
      await tx.inventoryMovements.create({
        data: {
          productId,
          variantId: variant.id,
          delta,
          reason: "manualAdjust",
          note: "quickCount",
        },
      });
      // đặt tồn = counted
      await tx.productVariants.update({
        where: { id: variant.id },
        data: { stock: targetCount },
      });
    });

    res.redirect("/admin/inventory-support#p-stock");
  } catch (e) {
    console.error(e);
    res.status(500).send("Quick Count error");
  }
}


// Commit preview from cache
export async function bulkCommit(req: Request, res: Response) {
  try {
    const lines = bulkPreviewCache || [];
    if (!lines.length) return res.status(400).send("No preview to commit");

    await prisma.$transaction(async (tx) => {
      for (const r of lines) {
        // 1) create movement
        await tx.inventoryMovements.create({
          data: {
            productId: r.productId,
            variantId: r.variantId || null,
            delta: r.delta,
            reason: (r.reason as any) || "manualAdjust",
            note: r.note || null,
          },
        });
        // 2) update productVariants.stock if variant provided
        if (r.variantId) {
          await tx.productVariants.update({
            where: { id: r.variantId },
            data: { stock: { increment: r.delta } },
          });
        } else {
          // no variantId → distribute to the first variant (fallback) or skip
          const first = await tx.productVariants.findFirst({
            where: { productId: r.productId },
            select: { id: true },
          });
          if (first) {
            await tx.productVariants.update({
              where: { id: first.id },
              data: { stock: { increment: r.delta } },
            });
          }
        }
      }
    });

    bulkPreviewCache = null;
    res.redirect("/admin/inventory-support#p-bulk");
  } catch (e) {
    console.error(e);
    res.status(500).send("Bulk commit error");
  }
}

/** ========= Barcode / QR ========= */
export async function barcode(req: Request, res: Response) {
  try {
    const { productId, variantId, type } = req.query as any;
    if (!productId) return res.status(400).send("productId required");

    // Build URL tới ảnh SVG
    const q = new URLSearchParams();
    q.set("productId", String(productId));
    if (variantId) q.set("variantId", String(variantId));
    q.set("type", String(type || "barcode"));

    const codeUrl = `/admin/inventory-support/barcode.svg?${q.toString()}`;

    // Lấy dữ liệu phụ để render trang
    const sessions = (await readSessions()).slice(0, 10);
    const negative = await prisma.productVariants.findMany({
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
      barcodeUrl: codeUrl, // <- đổi: trỏ sang endpoint ảnh SVG
      helpers: { money: fmtMoney },
    });
  } catch (e) {
    console.error(e);
    res.status(500).send("Barcode page error");
  }
}

/**
 * Trả về ẢNH SVG (Content-Type: image/svg+xml)
 *   GET /admin/inventory-support/barcode.svg?productId=...&variantId=...&type=barcode|qr
 */
export async function barcodeImage(req: Request, res: Response) {
  try {
    const { productId, variantId, type, symbology } = req.query as any;
    if (!productId) {
      res.status(400).type("text/plain").send("productId required");
      return;
    }

    const label = variantId ? `${productId}-${variantId}` : `${productId}`;

    if (String(type) === "qr") {
      // ✅ QR chuẩn (SVG)
      const svg = await QRCode.toString(label, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 2,      // quiet zone
        scale: 6,
      });
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.send(svg);
      return;
    }

    // ✅ Barcode chuẩn bằng bwip-js (PNG)
    // symbology mặc định: code128 — dễ dùng cho text chữ+số
    // Nếu bạn muốn EAN-13: truyền ?symbology=ean13 và đảm bảo 12 chữ số (bwip sẽ tự tính checksum)
    const bcid = String(symbology || "code128"); // e.g., 'code128', 'ean13', 'code39'...
    // Một số lưu ý:
    // - ean13 chỉ chấp nhận số; phải đủ 12 chữ số, checksum tự sinh.
    // - code39/code128 cho phép chữ+số nhưng code39 có alphabet hạn chế hơn.

    const png = await bwipjs.toBuffer({
      bcid,               // barcode type
      text: label,        // nội dung mã
      scale: 3,           // độ dày vạch (pixel)
      height: 12,         // chiều cao (mm)
      includetext: true,  // in text dưới barcode
      textxalign: 'center',
      textsize: 10,       // cỡ chữ dưới mã
      paddingwidth: 10,   // quiet zone trái/phải
      paddingheight: 10,  // quiet zone trên/dưới
      backgroundcolor: 'FFFFFF', // nền trắng
    });

    res.setHeader("Content-Type", "image/png");
    res.send(png);
  } catch (e: any) {
    console.error(e);
    res.status(500).type("text/plain").send("Barcode image error: " + (e?.message || e));
  }
}

/** ========= Export & Template ========= */

export async function exportCsv(req: Request, res: Response) {
  try {
    const range = String(req.query.range || "month");
    const { s, e } = getRange(range);

    const prods = await prisma.products.findMany({
      where: { deleted: false },
      select: {
        id: true,
        title: true,
        productVariants: { select: { id: true, stock: true } },
      },
    });

    const onHandMap = new Map<string, number>();
    for (const p of prods) {
      onHandMap.set(p.id, p.productVariants.reduce((t, v) => t + (v.stock || 0), 0));
    }

    const reservedItems = await prisma.orderItems.findMany({
      where: {
        orders: { status: { in: ["pending", "paid", "shipped"] }, createdAt: { gte: s, lt: e } },
      },
      select: { productId: true, quantity: true },
    });
    const reservedMap = new Map<string, number>();
    for (const it of reservedItems) {
      reservedMap.set(it.productId, (reservedMap.get(it.productId) || 0) + (it.quantity || 0));
    }

    const completed = await prisma.orderItems.findMany({
      where: { orders: { status: "completed", createdAt: { gte: s, lt: e } } },
      select: { productId: true, quantity: true, priceSnap: true },
    });
    const soldMap = new Map<string, number>();
    const revenueMap = new Map<string, number>();
    for (const it of completed) {
      soldMap.set(it.productId, (soldMap.get(it.productId) || 0) + (it.quantity || 0));
      revenueMap.set(it.productId, (revenueMap.get(it.productId) || 0) + (it.priceSnap || 0) * (it.quantity || 0));
    }

    const rows: (string | number)[][] = [
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
  } catch (e) {
    console.error(e);
    res.status(500).send("Export CSV error");
  }
}

export async function templateCsv(req: Request, res: Response) {
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
  } catch (e) {
    console.error(e);
    res.status(500).send("Template CSV error");
  }
}

/** ========= Diagnostics ========= */

export async function diagnostics(req: Request, res: Response) {
  try {
    const negative = await prisma.productVariants.findMany({
      where: { stock: { lt: 0 } },
      select: { id: true, productId: true, stock: true },
    });
    const orphan: { id: string }[] = []; // relation ensures none in normal case
    res.json({ ok: true, negative, orphan });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
}

/** ========= Rebuild OnHand from movements =========
 * Tính lại stock = SUM(delta) theo variantId từ bảng inventoryMovements.
 * CẢNH BÁO: Nếu bạn cũng cập nhật stock từ nơi khác, hãy cân nhắc trước khi chạy.
 */
export async function rebuildOnHand(req: Request, res: Response) {
  try {
    // Query all movement sums by variant
    const sums = await prisma.$queryRawUnsafe<{ variantid: string | null; sum: number }[]>(
      `
      SELECT "variantId" AS variantId, COALESCE(SUM(delta),0)::int AS sum
      FROM "inventoryMovements"
      GROUP BY "variantId"
      `
    );

    await prisma.$transaction(async (tx) => {
      for (const row of sums) {
        const variantId = (row as any).variantid ?? (row as any).variantId ?? null;
        if (!variantId) continue; // skip null variants (không biết variant để set)
        const sum = Number((row as any).sum || 0);
        await tx.productVariants.update({
          where: { id: variantId },
          data: { stock: sum },
        });
      }
    });

    res.redirect("/admin/inventory-support");
  } catch (e) {
    console.error(e);
    res.status(500).send("Rebuild onHand error");
  }
}
