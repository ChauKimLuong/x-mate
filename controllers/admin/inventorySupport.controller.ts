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

// super-naive CSV parser (no quotes support) â€” Ä‘á»§ dÃ¹ng cho template cá»§a mÃ¬nh
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

    // low-stock: top 10 theo onHand (dÃ¹ng cá»™t stock hiá»‡n táº¡i)
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
    // Orphan (variants without product) â€” trong Prisma Ä‘Ã£ cÃ³ relation báº¯t buá»™c; phÃ²ng há»:
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
      initTab: undefined,
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

    // Khai bÃ¡o kiá»ƒu rÃµ rÃ ng Ä‘á»ƒ TS hiá»ƒu
    const rows: (string | number)[][] = [
      ["productId", "title", "onHand", "reorderPoint", "suggestQty"],
    ];

    products.forEach((p) => {
      // Náº¿u productVariants rá»—ng -> onHand = 0
      const onHand = p.productVariants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
      const rp = 10; // reorder point
      const suggest = Math.max(0, rp - onHand);
      if (suggest > 0) rows.push([p.id, p.title, onHand, rp, suggest]);
    });

    const csv = toCsv(rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="reorder-draft.csv"'
    );
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
// View a session (render inline on helper page)
export async function viewStocktake(req: Request, res: Response) {
  try {
    const { sid } = req.params;

    // 1) Danh sÃ¡ch sessions (Ä‘á»ƒ table "Recent Sessions" váº«n cÃ²n)
    const sessions = (await readSessions())
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 10);

    const s = sessions.find((x) => x.id === sid);
    if (!s) return res.status(404).send("Session not found");

    // 2) Chuáº©n bá»‹ rows hiá»ƒn thá»‹ tÃ¹y tráº¡ng thÃ¡i
    let rows:
      | { title: string; variantId: string | null; systemOnHand: number | string; counted: number | string; delta: number | string }[]
      = [];

    if (s.status === "reviewing" && s.lines?.length) {
      rows = s.lines.map((r) => ({
        title: r.title,
        variantId: r.variantId || null,
        systemOnHand: r.systemOnHand ?? "-",
        counted: r.counted ?? "-",
        delta: r.delta ?? "-",
      }));
    } else if (s.status === "posted") {
      const moves = await prisma.inventoryMovements.findMany({
        where: { note: `stocktake ${s.id}` },
        select: {
          variantId: true,
          productId: true,
          delta: true,
          products: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      rows = moves.map((m) => ({
        title: m.products?.title || m.productId,
        variantId: m.variantId || null,
        systemOnHand: "-",
        counted: "-",
        delta: m.delta,
      }));
    }

    // 3) Low-stock + diagnostics nhÆ° trang page()
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
        stock: p.productVariants.reduce((sum, v) => sum + (v.stock || 0), 0),
        reorderPoint: 10,
      }))
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10);

    const negative = await prisma.productVariants.findMany({
      where: { stock: { lt: 0 } },
      select: { id: true, productId: true, stock: true },
    });

    // 4) Render helper vá»›i sessionDetail
    res.render("admin/pages/inventory-support/helper", {
      title: "Inventory Support",
      active: "inventory-support",
      lowStock,
      sessions,
      bulkPreview: null,
      diagnostics: { negative, orphan: [] },
      barcodeUrl: undefined,
      helpers: { money: fmtMoney },
      initTab: "p-stock",
      sessionDetail: {
        session: s,
        rows,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).send("View stocktake error");
  }
}

        // ======== Download CSV template for a stocktake session ========
export async function downloadStocktake(req: Request, res: Response) {
  try {
    const { sid } = req.params;
    const sessions = await readSessions();
    const s = sessions.find((x) => x.id === sid);
    if (!s) return res.status(404).send("Session not found");

    // Láº¥y danh sÃ¡ch variants + product liÃªn káº¿t
    const variants = await prisma.productVariants.findMany({
      select: {
        id: true,
        stock: true,
        products: {
          select: {
            id: true,
            title: true,
            status: true,
            deleted: true,
          },
        },
      },
    });

    // Chuáº©n bá»‹ dá»¯ liá»‡u CSV
    const rows: (string | number)[][] = [
      ["variantId", "productId", "title", "systemOnHand", "counted"],
    ];

    for (const v of variants) {
      const prod = v.products;
      if (!prod) continue;

      // Náº¿u scope = "active" â†’ bá» qua sáº£n pháº©m Ä‘Ã£ xÃ³a hoáº·c khÃ´ng active
      if (s.scope === "active" && (prod.deleted || prod.status !== "active"))
        continue;

      const on = v.stock ?? 0;

      // Náº¿u scope = "low" â†’ chá»‰ láº¥y sáº£n pháº©m cÃ³ tá»“n <= reorder point
      if (s.scope === "low") {
        const rp = 10;
        if (on > rp) continue;
      }

      rows.push([v.id, prod.id, prod.title, on, ""]);
    }

    // Xuáº¥t CSV
    const csv = toCsv(rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="stocktake-${sid}.csv"`
    );
    res.send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).send("Download stocktake error");
  }
}


// Upload stocktake CSV â†’ preview (session moves to reviewing)
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
// Post stocktake (commit deltas)
export async function postStocktake(req: Request, res: Response) {
  try {
    const { sid } = req.params;
    const sessions = await readSessions();
    const s = sessions.find((x) => x.id === sid);
    if (!s) return res.status(404).send("Session not found");
    if (!s.lines?.length) {
      return res.status(400).send("No lines to post. Please upload CSV first.");
    }

    // snapshot trÆ°á»›c khi ghi DB Ä‘á»ƒ hiá»ƒn thá»‹ láº¡i System/Counted sau khi posted
    const snapshot = s.lines.map(l => ({ ...l }));

    await prisma.$transaction(async (tx) => {
      for (const line of s.lines!) {
        if (line.counted == null || line.delta == null || line.delta === 0) continue;
        if (!line.productId || !line.variantId) continue;

        await tx.inventoryMovements.create({
          data: {
            productId: line.productId,
            variantId: line.variantId,
            delta: line.delta,
            reason: "manualAdjust",
            note: `stocktake ${s.id}`,
          },
        });

        await tx.productVariants.update({
          where: { id: line.variantId },
          data: { stock: line.counted },
        });
      }
    });

    s.status = "posted";
    (s as any).postedLines = snapshot; // giá»¯ System/Counted/Delta
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

    // LÆ°u Ã½: viá»‡c xÃ³a nÃ y chá»‰ xÃ³a metadata trong file JSON cá»§a stocktake,
    // khÃ´ng áº£nh hÆ°á»Ÿng cÃ¡c movement Ä‘Ã£ POST trÆ°á»›c Ä‘Ã³.
    sessions.splice(idx, 1);
    await writeSessions(sessions);

    res.redirect("/admin/inventory-support#p-stock");
  } catch (e) {
    console.error(e);
    res.status(500).send("Delete stocktake error");
  }
}


/** ========= Bulk Adjust ========= */

export async function stocktakeJson(req: Request, res: Response) {
  try {
    const { sid } = req.params;
    const sessions = await readSessions();
    const s = sessions.find((x) => x.id === sid);
    if (!s) return res.status(404).json({ ok: false, error: "Session not found" });

    let lines: StocktakeLine[] | null = null;
    let postedLines:
      | { variantId: string | null; productId: string; title: string; systemOnHand: number | string; counted: number | string; delta: number | string }[]
      | null = null;

    if (s.status === "reviewing" && s.lines?.length) {
      lines = s.lines;
    } else if (s.status === "posted") {
      const snap = (s as any).postedLines as StocktakeLine[] | undefined;
      if (snap?.length) {
        postedLines = snap.map(r => ({
          variantId: r.variantId || null,
          productId: r.productId,
          title: r.title,
          systemOnHand: r.systemOnHand ?? '-',
          counted: r.counted ?? '-',
          delta: r.delta ?? '-',
        }));
      } else {
        const moves = await prisma.inventoryMovements.findMany({
          where: { note: `stocktake ${s.id}` },
          select: {
            variantId: true,
            productId: true,
            delta: true,
            products: { select: { id: true, title: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        });
        postedLines = moves.map((m) => ({
          variantId: m.variantId || null,
          productId: m.productId,
          title: m.products?.title || m.productId,
          systemOnHand: '-',
          counted: '-',
          delta: m.delta,
        }));
      }
    }

    res.json({ ok: true, session: s, lines, postedLines });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
}


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

    // Láº¥y variant: Æ°u tiÃªn variantId, náº¿u khÃ´ng cÃ³ thÃ¬ láº¥y variant Ä‘áº§u tiÃªn cá»§a product
    const variant =
      variantId
        ? await prisma.productVariants.findUnique({ where: { id: variantId } })
        : await prisma.productVariants.findFirst({ where: { productId } });

    if (!variant) return res.status(404).send("Variant not found");

    const sys = variant.stock || 0;
    const delta = targetCount - sys;

    await prisma.$transaction(async (tx) => {
      // movement Ä‘á»ƒ trace
      await tx.inventoryMovements.create({
        data: {
          productId,
          variantId: variant.id,
          delta,
          reason: "manualAdjust",
          note: "quickCount",
        },
      });
      // Ä‘áº·t tá»“n = counted
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
          // no variantId â†’ distribute to the first variant (fallback) or skip
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
    const { productId, variantId, type, base } = req.query as any;
    if (!productId) return res.status(400).send("productId required");

    // Build URL tá»›i áº£nh SVG
    const q = new URLSearchParams();
    q.set("productId", String(productId));
    if (variantId) q.set("variantId", String(variantId));
    q.set("type", String(type || "barcode"));
    if (base) q.set("base", String(base));

    const codeUrl = `/admin/inventory-support/barcode.svg?${q.toString()}`;

    // Láº¥y dá»¯ liá»‡u phá»¥ Ä‘á»ƒ render trang
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
      barcodeUrl: codeUrl, // <- Ä‘á»•i: trá» sang endpoint áº£nh SVG
      helpers: { money: fmtMoney },
    });
  } catch (e) {
    console.error(e);
    res.status(500).send("Barcode page error");
  }
}

/**
 * Tráº£ vá» áº¢NH SVG (Content-Type: image/svg+xml)
 *   GET /admin/inventory-support/barcode.svg?productId=...&variantId=...&type=barcode|qr
 */
export async function barcodeImage(req: Request, res: Response) {
  try {
    const { productId, variantId, type, symbology } = req.query as any;
    if (!productId) {
      res.status(400).type("text/plain").send("productId required");
      return;
    }

    // Prefer deep-link URL for QR so scanners open product detail directly
    let label = variantId ? `${productId}-${variantId}` : `${productId}`;
    if (String(type) === "qr") {
      try {
        // Accept either ID or slug from the input; also allow explicit ?slug=...
        const qSlug = String((req.query as any).slug || "").trim();
        const qPid = String(productId || "").trim();
        let slug: string | null = null;
        if (qSlug) {
          slug = qSlug;
        } else {
          const byId = await prisma.products.findUnique({ where: { id: qPid }, select: { slug: true } });
          slug = byId?.slug || null;
          if (!slug) {
            const bySlug = await prisma.products.findFirst({ where: { slug: qPid }, select: { slug: true } });
            slug = bySlug?.slug || null;
          }
        }

        // Determine origin (base URL). Priority: ?base=... > env > forwarded host > req host
        const rawBase = String(
          (req.query as any).base ||
          process.env.PUBLIC_BASE_URL ||
          process.env.APP_URL ||
          ""
        ).trim();
        const xfProto = (req.headers["x-forwarded-proto"] as string) || "";
        const xfHost = (req.headers["x-forwarded-host"] as string) || "";
        const proto = (xfProto || req.protocol || "http").split(",")[0];
        const host = (xfHost || req.get("host") || "").split(",")[0];

        function normalizeOrigin(input: string): string {
          const s = (input || "").replace(/\/$/, "");
          try {
            // If scheme is missing, URL will throw; handle gracefully
            const hasScheme = /^https?:\/\//i.test(s);
            const u = new URL(hasScheme ? s : `${proto}://${s}`);
            return `${u.protocol}//${u.host}`; // strip path/query if any
          } catch {
            return s;
          }
        }

        const origin = normalizeOrigin(rawBase || (host ? `${proto}://${host}` : ""));

        if (slug && origin) {
          // Use URL to join to avoid double slashes
          label = new URL(`/product/detail/${slug}`, origin).toString();
        }
      } catch {}
    }

    if (String(type) === "qr") {
      // âœ… QR chuáº©n (SVG)
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

    // âœ… Barcode chuáº©n báº±ng bwip-js (PNG)
    // symbology máº·c Ä‘á»‹nh: code128 â€” dá»… dÃ¹ng cho text chá»¯+sá»‘
    // Náº¿u báº¡n muá»‘n EAN-13: truyá»n ?symbology=ean13 vÃ  Ä‘áº£m báº£o 12 chá»¯ sá»‘ (bwip sáº½ tá»± tÃ­nh checksum)
    const bcid = String(symbology || "code128"); // e.g., 'code128', 'ean13', 'code39'...
    // Má»™t sá»‘ lÆ°u Ã½:
    // - ean13 chá»‰ cháº¥p nháº­n sá»‘; pháº£i Ä‘á»§ 12 chá»¯ sá»‘, checksum tá»± sinh.
    // - code39/code128 cho phÃ©p chá»¯+sá»‘ nhÆ°ng code39 cÃ³ alphabet háº¡n cháº¿ hÆ¡n.

    const png = await bwipjs.toBuffer({
      bcid,               // barcode type
      text: label,        // ná»™i dung mÃ£
      scale: 3,           // Ä‘á»™ dÃ y váº¡ch (pixel)
      height: 12,         // chiá»u cao (mm)
      includetext: true,  // in text dÆ°á»›i barcode
      textxalign: 'center',
      textsize: 10,       // cá»¡ chá»¯ dÆ°á»›i mÃ£
      paddingwidth: 10,   // quiet zone trÃ¡i/pháº£i
      paddingheight: 10,  // quiet zone trÃªn/dÆ°á»›i
      backgroundcolor: 'FFFFFF', // ná»n tráº¯ng
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

    // ======= reserved (pending / paid / shipped)
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
      reservedMap.set(it.product_id, (reservedMap.get(it.product_id) || 0) + (it.quantity || 0));
    }

    // ======= completed
    const completed = await prisma.order_items.findMany({
      where: {
        orders: { status: "completed", created_at: { gte: s, lt: e } },
      },
      select: { product_id: true, quantity: true, price: true },
    });

    const soldMap = new Map<string, number>();
    const revenueMap = new Map<string, number>();
    for (const it of completed) {
      soldMap.set(it.product_id, (soldMap.get(it.product_id) || 0) + (it.quantity || 0));
      revenueMap.set(
        it.product_id,
        (revenueMap.get(it.product_id) || 0) + Number(it.price || 0) * (it.quantity || 0)
      );
    }

    // ======= export rows
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
 * TÃ­nh láº¡i stock = SUM(delta) theo variantId tá»« báº£ng inventoryMovements.
 * Cáº¢NH BÃO: Náº¿u báº¡n cÅ©ng cáº­p nháº­t stock tá»« nÆ¡i khÃ¡c, hÃ£y cÃ¢n nháº¯c trÆ°á»›c khi cháº¡y.
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
        if (!variantId) continue; 
        const sum = Number((row as any).sum || 0);
        await tx.productVariants.update({
          where: { id: variantId },
          data: { stock: Math.max(0, sum) },
        });
      }
    });

    res.redirect("/admin/inventory-support");
  } catch (e) {
    console.error(e);
    res.status(500).send("Rebuild onHand error");
  }
}

// Simple product lookup for Quick Count UI
export async function lookup(req: Request, res: Response) {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ ok: true, items: [] });
    const items = await prisma.products.findMany({
      where: { deleted: false, title: { contains: q, mode: "insensitive" as any } },
      select: {
        id: true,
        title: true,
        productVariants: { select: { id: true }, take: 1 },
      },
      take: 20,
      orderBy: { title: "asc" },
    });
    const rows = items.map((p) => ({
      productId: p.id,
      title: p.title,
      variantId: p.productVariants?.[0]?.id || null,
    }));
    res.json({ ok: true, items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
}

