// controllers/admin/products.controller.ts
import { Request, Response } from "express";
import prisma from "../../config/database";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import qs from "qs";
/* ========= Helpers chung ========= */
const formatMoney = (n: number) => `${(Number(n) || 0).toLocaleString('vi-VN')}đ`;
const toInt = (v: any) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0);
const val = (v?: any) => (typeof v === "string" ? v.trim() : v);

// slug cơ bản (bỏ dấu, chỉ a-z0-9 và gạch)
const slugify = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "san-pham";

// tạo slug duy nhất (base | base-2 | base-3 ...)
async function uniqueSlug(base: string) {
  let slug = base;
  let i = 1;
  const candidates = await prisma.products.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const taken = new Set(candidates.map((x) => x.slug));
  while (taken.has(slug)) slug = `${base}-${++i}`;
  return slug;
}

// chuẩn hoá key màu (để map sample ảnh theo màu)
const normColor = (s?: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// khung thời gian filter list
function getRange(range?: string) {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (String(range).toLowerCase() === 'all') {
    const s = new Date(0);
    const e = new Date(now.getFullYear() + 1, 0, 1);
    return { s, e, label: 'Tất cả' };
  }
  if (range === "today") {
    const s = startOfDay(now); const e = new Date(s); e.setDate(e.getDate() + 1);
    return { s, e, label: "Hôm nay" };
  }
  if (range === "week") {
    const d = new Date(now); const day = d.getDay() || 7;
    const s = startOfDay(new Date(d)); s.setDate(s.getDate() - (day - 1));
    const e = new Date(s); e.setDate(e.getDate() + 7);
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

// lưu file vào /public/uploads (trả về URL public bắt đầu /uploads/..)
async function saveFileToPublic(file: Express.Multer.File, destDir = "public/uploads") {
  const ext = (file.originalname.split(".").pop() || "bin").toLowerCase().split("?")[0];
  const id = randomUUID();
  const rel = `${destDir}/${id}.${ext}`;
  const abs = path.join(process.cwd(), rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, file.buffer);
  return "/" + rel.replace(/^public\//, "");
}

/* ========= Controllers ========= */

// GET /admin/products
export const getProducts = async (req: Request, res: Response) => {
  const allMode = String(req.query.take || '').toLowerCase() === 'all'
    || String(req.query.all || '') === '1';
  const page = Math.max(1, Number(req.query.page) || 1);
  const take = allMode ? undefined : Math.min(50, Number(req.query.take) || 10);
  const skip = allMode ? undefined : (page - 1) * (take as number);
  const range = String(req.query.range || "month");
  const { s, e, label } = getRange(range);
  const keyword = String(req.query.q || '').trim();

  const createdFilter = { createdAt: { gte: s, lt: e } };
  const where: any = { deleted: false, ...createdFilter };
  if (keyword) {
    where.title = { contains: keyword, mode: 'insensitive' } as any;
  }

  const [rows, total] = await Promise.all([
    prisma.products.findMany({
      where,
      include: {
        categories: { select: { title: true } },
        productVariants: {
          where: { deleted: false },
          select: { stock: true, images: true, color: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(allMode ? {} : { skip, take }),
    }),
    prisma.products.count({ where }),
  ]);

  const products = rows.map((p) => {
    const variants = Array.isArray(p.productVariants) ? p.productVariants : [];
    const variantImages = variants.flatMap(v => Array.isArray(v.images) ? v.images : []);
    const firstVariantImg = variantImages.find(Boolean);

    // Ảnh đại diện: thumbnail -> ảnh variant đầu tiên -> placeholder
    const img = p.thumbnail || firstVariantImg || "/images/placeholder.jpg";

    // Tồn kho còn lại
    const stockLeft = variants.reduce((sum, v) => sum + (toInt(v.stock) || 0), 0);

    // Sizes: dùng đúng field p.size (mảng trong schema). Nếu bạn muốn default, mở comment dòng dưới.
    const sizes = Array.isArray(p.size) ? p.size : [];
    // const sizes = Array.isArray(p.size) && p.size.length ? p.size : ['S','M','L','XL']; // (tuỳ bạn)

    return {
      id: p.id,
      img,                      // đã fallback
      name: p.title,
      sizes,                    // luôn là mảng (kể cả rỗng)
      priceText: formatMoney(p.price),
      left: stockLeft,
      sold: p.soldCount,
      category: p.categories?.title || "—",
      rating: p.ratingAvg,
      reviews: p.ratingCount,
      slug: p.slug,             // nếu cần link trong action/view
    };
  });

  res.render("admin/pages/products/list", {
    title: "Product List",
    active: "products",
    products,
    pagination: { page, take: (allMode ? total : (take as number) || 10), total },
    filterLabel: label,
    range,
    allMode,
    keyword,
  });
};


// GET /admin/products/create
export const showCreateProduct = async (_req: Request, res: Response) => {
  const [categories, pv] = await Promise.all([
    prisma.categories.findMany({
      where: { deleted: false, status: "active" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.productVariants.findMany({
      select: { color: true, images: true },
      take: 500,
    }),
  ]);

  // build gợi ý màu + mẫu ảnh theo màu (key đã chuẩn hoá)
  const samplesByColor: Record<string, string[]> = {};
  const colorSet = new Set<string>();
  for (const v of pv) {
    const original = (v.color || "").trim();
    if (!original) continue;
    colorSet.add(original);
    const key = normColor(original);
    (samplesByColor[key] ||= []);
    (v.images || []).forEach(u => { if (u) samplesByColor[key].push(u); });
  }
  const colors = Array.from(colorSet).sort((a, b) => a.localeCompare(b));

  res.render("admin/pages/products/create", {
    title: "Create Product", active: "products",
    categories, variantOptions: { colors, samplesByColor },
  });
};

// POST /admin/products
export const createProduct = async (req: Request, res: Response) => {
  try {
    const b = req.body as any;
    const files = (req.files as Express.Multer.File[]) || [];

    const title = val(b.title);
    const categoryId = val(b.categoryId);
    const status: "active" | "inactive" = (b.status === "inactive" ? "inactive" : "active");
    const price = toInt(b.price);
    const discount = toInt(b.discount);
    const description = val(b.description);

    // size[] có thể là string | string[] | undefined
    const sizeRaw = b["size[]"] ?? b.size ?? [];
    const sizes: string[] = Array.isArray(sizeRaw) ? sizeRaw.filter(Boolean) : (sizeRaw ? [String(sizeRaw)] : []);

    // Thumbnail: ưu tiên URL, fallback file upload "thumbnail"
    const thumbnailUrl = val(b.thumbnailUrl);
    let thumbnail = "";
    if (thumbnailUrl) thumbnail = thumbnailUrl;
    else {
      const thumbFile = files.find((f) => f.fieldname === "thumbnail");
      if (thumbFile) thumbnail = await saveFileToPublic(thumbFile);
    }

    if (!title || !categoryId || !thumbnail) {
      return res.status(400).send("Missing required fields (title/category/thumbnail).");
    }

    // slug duy nhất
    const baseSlug = slugify(String(title));
    const slug = await uniqueSlug(baseSlug);

    // ===== Gom variants từ body + files =====
    type VItem = {
      color?: string;
      stock?: number;
      urls: string[];
      files: Express.Multer.File[];
      colorId?: string | null;
      colorHexLegacy?: string | null;
      swatchUrlLegacy?: string | null;
    };
    const variantMap: Record<string, VItem> = {};

    // --- Parse "variants" ở nhiều định dạng: JSON string | array | object {"0":{...}} ---
    let vRaw: any = null;
    if (typeof b.variants === "string") {
      try { vRaw = JSON.parse(b.variants); } catch { /* ignore */ }
    } else if (b.variants && typeof b.variants === "object") {
      vRaw = b.variants;
    }

    // 1) ARRAY: [{...}, {...}]
    if (Array.isArray(vRaw)) {
      vRaw.forEach((node: any, i: number) => {
        const item: VItem = { urls: [], files: [] };
        if (node) {
          if (node.color != null) item.color = val(node.color);
          if (node.stock != null) item.stock = toInt(node.stock);
          if (node.colorId != null) item.colorId = val(node.colorId) || null;
          if (node.colorHexLegacy != null) item.colorHexLegacy = val(node.colorHexLegacy) || null;
          if (node.swatchUrlLegacy != null) item.swatchUrlLegacy = val(node.swatchUrlLegacy) || null;

          const raw = node.imageUrls;
          const pushLines = (t: string) =>
            String(t || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach(u => item.urls.push(u));
          Array.isArray(raw) ? raw.forEach(pushLines) : raw && pushLines(raw);
        }
        variantMap[String(i)] = item;
      });
    }

    // 2) OBJECT: {"0": {...}, "1": {...}}
    if (vRaw && typeof vRaw === "object" && !Array.isArray(vRaw)) {
      for (const idx of Object.keys(vRaw)) {
        const node = vRaw[idx] || {};
        const item: VItem = { urls: [], files: [] };
        if (node.color != null) item.color = val(node.color);
        if (node.stock != null) item.stock = toInt(node.stock);
        if (node.colorId != null) item.colorId = val(node.colorId) || null;
        if (node.colorHexLegacy != null) item.colorHexLegacy = val(node.colorHexLegacy) || null;
        if (node.swatchUrlLegacy != null) item.swatchUrlLegacy = val(node.swatchUrlLegacy) || null;

        const raw = node.imageUrls;
        const pushLines = (t: string) =>
          String(t || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach(u => item.urls.push(u));
        Array.isArray(raw) ? raw.forEach(pushLines) : raw && pushLines(raw);

        variantMap[idx] = item;
      }
    }

    // 3) Flat keys: variants[0][...]
    Object.keys(b).forEach((k) => {
      const m = k.match(/^variants\[(\d+)\]\[(color|stock|imageUrls|colorId|colorHexLegacy|swatchUrlLegacy)\](?:\[\])?$/);
      if (!m) return;
      const idx = m[1];
      const field = m[2] as "color" | "stock" | "imageUrls" | "colorId" | "colorHexLegacy" | "swatchUrlLegacy";
      variantMap[idx] ||= { urls: [], files: [] };

      if (field === "color") variantMap[idx].color = val(b[k]);
      else if (field === "stock") variantMap[idx].stock = toInt(b[k]);
      else if (field === "imageUrls") {
        const raw = b[k];
        const pushLines = (t: string) =>
          String(t || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean).forEach((u) => variantMap[idx].urls.push(u));
        Array.isArray(raw) ? raw.forEach(pushLines) : raw && pushLines(raw);
      } else {
        (variantMap[idx] as any)[field] = val(b[k]) || null;
      }
    });

    // 4) Files: variants[IDX][images][]
    files.forEach((f) => {
      const m = f.fieldname.match(/^variants\[(\d+)\]\[images\]\[\]$/);
      if (!m) return;
      const idx = m[1];
      variantMap[idx] ||= { urls: [], files: [] };
      variantMap[idx].files.push(f);
    });

    // Build mảng create variants (stock có thể = 0)
    type VOut = {
      id: string;
      color: string;
      stock: number;
      images: string[];
      colorId?: string | null;
      colorHexLegacy?: string | null;
      swatchUrlLegacy?: string | null;
    };
    const variantsData: VOut[] = [];

    for (const idx of Object.keys(variantMap).sort((a, b) => Number(a) - Number(b))) {
      const v = variantMap[idx];
      if (v.stock === undefined || v.stock === null) continue;

      // Lấy tên màu trực tiếp từ form (dù có hoặc không có colorId)
      const colorName = (v.color && String(v.color).trim()) || "";
      if (!colorName) continue; // productVariants.color là NOT NULL

      const uploadedUrls: string[] = [];
      for (const f of v.files) {
        uploadedUrls.push(await saveFileToPublic(f, "public/uploads/variants"));
      }

      variantsData.push({
        id: randomUUID(),
        color: colorName,
        stock: toInt(v.stock), // 0 vẫn hợp lệ
        images: [...v.urls, ...uploadedUrls],
        colorId: v.colorId ?? null,
        colorHexLegacy: v.colorHexLegacy ?? null,
        swatchUrlLegacy: v.swatchUrlLegacy ?? null,
      });
    }

    if (variantsData.length === 0) {
      console.error("No variants parsed from form payload", { bodyKeys: Object.keys(b).slice(0, 50) });
      return res.status(400).send("No variants provided or parsed.");
    }

    // === UPSERT COLORS & attach colorId khi người dùng chỉ nhập tên + hex/img ===
    type ColorUpsertNeed = { slug: string; name: string; hex?: string | null; swatchUrl?: string | null };
    const colorNeedsMap = new Map<string, ColorUpsertNeed>(); // key = slug

    for (const v of variantsData) {
      if (!v.colorId) {
        const name = v.color?.trim();
        if (!name) continue;
        const slug = slugify(name);
        const cur = colorNeedsMap.get(slug) || { slug, name, hex: null, swatchUrl: null };
        if (!cur.hex && v.colorHexLegacy) cur.hex = v.colorHexLegacy;
        if (!cur.swatchUrl && v.swatchUrlLegacy) cur.swatchUrl = v.swatchUrlLegacy;
        colorNeedsMap.set(slug, cur);
      }
    }

    const upsertedColorIdsBySlug: Record<string, string> = {};
    for (const need of colorNeedsMap.values()) {
      const created = await prisma.colors.upsert({
        where: { slug: need.slug },
        update: {
          name: need.name,
          hex: need.hex ?? undefined,
          swatchUrl: need.swatchUrl ?? undefined,
          updatedAt: new Date(),
        },
        create: {
          id: randomUUID(),
          name: need.name,
          slug: need.slug,
          hex: need.hex ?? undefined,
          swatchUrl: need.swatchUrl ?? undefined,
        },
        select: { id: true, slug: true },
      });
      upsertedColorIdsBySlug[created.slug] = created.id;
    }

    for (const v of variantsData) {
      if (!v.colorId) {
        const slug = slugify(v.color);
        const cid = upsertedColorIdsBySlug[slug];
        if (cid) v.colorId = cid;
      }
    }

    const productId = randomUUID();

    await prisma.products.create({
      data: {
        id: productId,
        title: String(title),
        description: description ?? null,
        price,
        discount,
        categoryId: String(categoryId),
        size: sizes,
        thumbnail,
        status,
        slug, // dùng cho /product/detail/:slug
        productVariants: {
          create: variantsData.map((v) => ({
            id: v.id,
            color: v.color,
            stock: v.stock,
            images: v.images,
            colorId: v.colorId,
            colorHexLegacy: v.colorHexLegacy,
            swatchUrlLegacy: v.swatchUrlLegacy,
          })),
        },
      },
    });

    res.redirect(`/admin/products?created=1`);
  } catch (err) {
    console.error("Create product failed.", err);
    res.status(500).send("Create product failed.");
  }
};
// ===== VIEW: GET /admin/products/:id
export const showProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const row = await prisma.products.findUnique({
      where: { id },
      include: {
        categories: { select: { id: true, title: true } },
        productVariants: {
          where: { deleted: false },
          include: { colors: { select: { id: true, name: true, hex: true, swatchUrl: true } } },
          orderBy: { id: 'asc' },
        }
      },
    });

    if (!row) return res.status(404).render("admin/pages/products/view", { product: null });

    const pv = Array.isArray(row.productVariants) ? row.productVariants.filter((v: any) => !v.deleted) : [];
    const stockLeft = pv.reduce((s, v) => s + ((Number(v.stock) || 0)), 0);
    const statusText = row.status === 'inactive' ? 'Inactive' : 'Active';
    const statusClass = row.status === 'inactive' ? 'pv-badge pv-badge--muted' : 'pv-badge pv-badge--ok';

    const viewModel = {
      ...row,
      categoryTitle: row.categories?.title || '—',
      priceText: (Number(row.price)||0).toLocaleString("vi-VN") + "đ",
      stockLeft,
      variantCount: pv.length,
      images: [ row.thumbnail, ...pv.flatMap(v => v.images || []) ].filter(Boolean),
      statusText,
      statusClass,
    };

    return res.render("admin/pages/products/view", {
      title: "Product Detail",
      active: "products",
      product: viewModel,
    });
  } catch (err) {
    console.error("showProduct error:", err);
    // tránh double send
    if (!res.headersSent) return res.status(500).send("Internal error.");
  }
};


// ===== EDIT FORM: GET /admin/products/:id/edit
export const editProductForm = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log("🟡 editProductForm -> req.params.id =", id);

    // ✅ Bước 1: kiểm tra id có hợp lệ không
    if (!id || id === "undefined" || id === ":id") {
      console.error("❌ editProductForm: missing or invalid id param");
      return res.status(400).send("Missing or invalid product ID in URL.");
    }

    // ✅ Bước 2: lấy dữ liệu song song (product + categories)
    const [row, categories] = await Promise.all([
      prisma.products.findUnique({
        where: { id },
        include: {
          productVariants: {
            where: { deleted: false },
            include: {
              colors: {
                select: { id: true, name: true, hex: true, swatchUrl: true },
              },
            },
            orderBy: { id: "asc" },
          },
          categories: { select: { id: true, title: true } },
        },
      }),
      prisma.categories.findMany({
        where: { deleted: false, status: "active" },
        select: { id: true, title: true },
        orderBy: { title: "asc" },
      }),
    ]);

    console.log("🟢 editProductForm -> row?.id =", row?.id);

    // ✅ Bước 3: nếu không tìm thấy product → trả về view trống (để tránh crash)
    if (!row) {
      return res.status(404).render("admin/pages/products/edit", {
        title: "Edit Product (Not Found)",
        active: "products",
        product: null,
        categories,
      });
    }

    // ✅ Bước 4: render ra view, key phải là `product`
    return res.render("admin/pages/products/edit", {
      title: `Edit Product: ${row.title}`,
      active: "products",
      product: row, // <— đúng key, tương thích với `- const p = product || {}` trong pug
      categories,
    });
  } catch (err) {
    console.error("💥 editProductForm error:", err);
    if (!res.headersSent) {
      res.status(500).send("Internal server error while loading edit form.");
    }
  }
};
// ===== UPDATE: POST /admin/products/:id

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      console.error("❌ updateProduct: Missing id param");
      return res.status(400).send("Missing product id.");
    }

    console.log("🟢 updateProduct -> req.params.id =", id);

    // 1) Parse body an toàn cho variants[0][...]
    const b = qs.parse(req.body) as any;
    const files = (req.files as Express.Multer.File[]) || [];

    // ---- helpers
    const toIntStrict = (v: any): number | undefined => {
      if (v === undefined || v === null) return undefined;
      const s = String(v).trim().replace(/[,\s.]/g, "");
      if (s === "") return undefined;
      const n = Number(s);
      return Number.isFinite(n) ? Math.trunc(n) : undefined;
    };
    const isHttpUrl = (s: string) => /^https?:\/\//i.test(String(s || "").trim());
    const pushLines = (t: string, into: string[]) =>
      String(t || "")
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((u) => into.push(u));

    // ---- fields cơ bản
    const title = (b.title || "").trim();
    const categoryId = (b.categoryId || "").trim();
    const status: "active" | "inactive" = b.status === "inactive" ? "inactive" : "active";
    const price = toIntStrict(b.price) ?? 0;
    const discount = toIntStrict(b.discount) ?? 0;
    const description = typeof b.description === "string" ? b.description : null;

    const sizeRaw = b["size[]"] ?? b.size ?? [];
    const sizes: string[] = Array.isArray(sizeRaw) ? sizeRaw.filter(Boolean) : sizeRaw ? [String(sizeRaw)] : [];

    // ---- thumbnail
    const thumbnailUrl = (b.thumbnailUrl || "").trim();
    let thumbnail: string | undefined = undefined;
    if (thumbnailUrl) {
      thumbnail = thumbnailUrl;
    } else {
      const thumbFile = files.find((f) => f.fieldname === "thumbnail");
      if (thumbFile) thumbnail = await saveFileToPublic(thumbFile);
    }

    // ---- parse variants vào variantMap
    type VItem = {
      id?: string | null;
      _delete?: boolean;
      color?: string;
      stock?: number;
      urls: string[];
      files: Express.Multer.File[];
      colorHexLegacy?: string | null;
      swatchUrlLegacy?: string | null;
      imagesMode?: "append" | "replace";
      _uploadedUrls?: string[]; // sẽ set trước transaction
    };
    const variantMap: Record<string, VItem> = {};

    // (A) Ưu tiên: nếu qs đã nested -> b.variants là array/object
    const vRaw = (b && b.variants) || undefined;
    if (vRaw && typeof vRaw === "object") {
      const assignFromNode = (idx: string, node: any) => {
        const it: VItem = (variantMap[idx] ||= { urls: [], files: [] });
        if (node == null) return;
        if (node.id != null) it.id = String(node.id || "").trim() || null;
        if (node._delete != null) it._delete = node._delete === "1" || node._delete === true || node._delete === "true";
        if (node.color != null) it.color = typeof node.color === "string" ? node.color.trim() : node.color;
        if (node.stock != null) {
          const maybe = toIntStrict(node.stock);
          if (maybe !== undefined && maybe >= 0) it.stock = maybe;
        }
        if (node.colorHexLegacy != null) it.colorHexLegacy = String(node.colorHexLegacy || "").trim() || null;
        if (node.swatchUrlLegacy != null) it.swatchUrlLegacy = String(node.swatchUrlLegacy || "").trim() || null;
        if (node.imagesMode != null) {
          const v = String(node.imagesMode || "").toLowerCase();
          it.imagesMode = v === "replace" ? "replace" : "append";
        }
        if (node.imageUrls != null) {
          if (Array.isArray(node.imageUrls)) node.imageUrls.forEach((t: string) => pushLines(t, it.urls));
          else pushLines(String(node.imageUrls || ""), it.urls);
        }
      };
      if (Array.isArray(vRaw)) {
        vRaw.forEach((node: any, i: number) => assignFromNode(String(i), node));
      } else {
        Object.keys(vRaw).forEach((k) => assignFromNode(k, (vRaw as any)[k]));
      }
    }

    // (B) Fallback: thêm từ key phẳng (nếu còn sót)
    Object.keys(req.body || {}).forEach((key) => {
      const m = key.match(
        /^variants\[([\w-]+)\]\[(id|_delete|color|stock|imageUrls|colorHexLegacy|swatchUrlLegacy|imagesMode)\](?:\[\])?$/
      );
      if (!m) return;
      const idx = m[1];
      const field = m[2] as keyof VItem | "imageUrls";
      const it: VItem = (variantMap[idx] ||= { urls: [], files: [] });
      const rawVal = (req.body as any)[key];

      if (field === "imageUrls") {
        Array.isArray(rawVal) ? rawVal.forEach((t: string) => pushLines(t, it.urls)) : pushLines(String(rawVal || ""), it.urls);
        return;
      }
      if (field === "stock") {
        const maybe = toIntStrict(rawVal);
        if (maybe !== undefined && maybe >= 0) it.stock = maybe;
        return;
      }
      if (field === "_delete") {
        it._delete = rawVal === "1" || rawVal === "true" || rawVal === true;
        return;
      }
      if (field === "id") {
        it.id = (String(rawVal || "").trim() || null) as any;
        return;
      }
      if (field === "imagesMode") {
        const v = String(rawVal || "").toLowerCase();
        it.imagesMode = v === "replace" ? "replace" : "append";
        return;
      }
      (it as any)[field] = typeof rawVal === "string" ? rawVal.trim() : rawVal;
    });

    // (C) Files: variants[IDX][images][]
    files.forEach((f) => {
      const mm = f.fieldname.match(/^variants\[([\w-]+)\]\[images\]\[\]$/);
      if (!mm) return;
      const idx = mm[1];
      (variantMap[idx] ||= { urls: [], files: [] }).files.push(f);
    });

    // Log kiểm tra
    const keys = Object.keys(variantMap).sort((a, b) => Number(a) - Number(b));
    console.log("VARIANT MAP KEYS:", keys);

    // Preflight: detect variants that are referenced (will soft-delete those)
    const toDeleteIds = Object.keys(variantMap)
      .map((k) => variantMap[k])
      .filter((v) => v && v.id && v._delete)
      .map((v) => String(v.id));

    const blocked = new Set<string>();
    if (toDeleteIds.length > 0) {
      const [cartRefs, orderRefs, invRefs] = await Promise.all([
        prisma.cart_items.findMany({ where: { variant_id: { in: toDeleteIds } }, select: { variant_id: true } }),
        prisma.order_items.findMany({ where: { variant_id: { in: toDeleteIds } }, select: { variant_id: true } }),
        prisma.inventoryMovements.findMany({ where: { variantId: { in: toDeleteIds } }, select: { variantId: true } }),
      ]);
      cartRefs.forEach((c) => blocked.add(c.variant_id));
      orderRefs.forEach((o) => o.variant_id && blocked.add(o.variant_id));
      invRefs.forEach((m) => m.variantId && blocked.add(m.variantId));
      if (blocked.size > 0) {
        console.warn("Soft-deleting referenced variants:", Array.from(blocked));
      }
    }
    for (const k of keys) {
      const v = variantMap[k];
      console.log(" -", k, { id: v.id, color: v.color, stock: v.stock, urls: v.urls?.length, files: v.files?.length });
    }

    // 2) Chuẩn bị dữ liệu ảnh ngoài transaction (tránh timeout)
    for (const idx of keys) {
      const v = variantMap[idx];
      const uploaded: string[] = [];
      for (const f of v.files) {
        uploaded.push(await saveFileToPublic(f, "public/uploads/variants"));
      }
      v._uploadedUrls = uploaded;
    }

    // 3) Lấy ảnh hiện tại của variants để hỗ trợ append
    const current = await prisma.productVariants.findMany({
      where: { productId: id },
      select: { id: true, images: true, stock: true },
    });
    const currentImgMap = new Map(current.map((v) => [v.id, Array.isArray(v.images) ? v.images : []]));
    const currentStockMap = new Map(current.map((v) => [v.id, Number.isFinite(Number(v.stock)) ? Number(v.stock) : 0]));

    // 4) Transaction: chỉ query DB
    await prisma.$transaction(async (tx) => {
      // 4.1 Update product
      await tx.products.update({
        where: { id },
        data: {
          title,
          description,
          price,
          discount,
          categoryId,
          size: sizes,
          status,
          ...(thumbnail ? { thumbnail } : {}),
          updatedAt: new Date(),
        },
      });

      // 4.2 Upsert variants
      for (const idx of keys) {
        const v = variantMap[idx];

        // validate color swatch (mutually exclusive)
        let colorHexLegacy = (v.colorHexLegacy || "") as string;
        let swatchUrlLegacy = (v.swatchUrlLegacy || "") as string;
        const hexOk = /^#?[0-9a-fA-F]{3}$/.test(colorHexLegacy) || /^#?[0-9a-fA-F]{6}$/.test(colorHexLegacy);
        const urlOk = isHttpUrl(swatchUrlLegacy);
        if (urlOk) colorHexLegacy = "";
        else if (hexOk) swatchUrlLegacy = "";
        else {
          colorHexLegacy = "";
          swatchUrlLegacy = "";
        }

        // Normalize incoming image URLs (dedupe + trim)
        const rawIncoming = [...(v.urls || []), ...(v._uploadedUrls || [])]
          .map((u) => (typeof u === 'string' ? u.trim() : ''))
          .filter(Boolean);
        const mode: "append" | "replace" = v.imagesMode || "append";

        if (v.id) {
          // existing
          if (v._delete) {
            if (blocked.has(String(v.id))) {
              await tx.productVariants.update({ where: { id: v.id }, data: { deleted: true, deletedAt: new Date(), stock: 0 } });
            } else {
              await tx.productVariants.delete({ where: { id: v.id } });
            }
            continue;
          }
          const data: any = {};
          if (typeof v.color === "string" && v.color.trim()) data.color = v.color.trim();
          if (v.stock !== undefined && Number.isFinite(v.stock) && v.stock >= 0) data.stock = v.stock;

          data.colorHexLegacy = colorHexLegacy || null;
          data.swatchUrlLegacy = swatchUrlLegacy || null;

          if (rawIncoming.length > 0) {
            if (mode === "append") {
              const existing = currentImgMap.get(v.id) || [];
              const existSet = new Set(existing);
              const uniqIncoming = Array.from(new Set(rawIncoming)).filter((u) => !existSet.has(u));
              if (uniqIncoming.length > 0) {
                data.images = [...existing, ...uniqIncoming];
              }
            } else {
              // replace with unique list
              data.images = Array.from(new Set(rawIncoming));
            }
          }

          await tx.productVariants.update({ where: { id: v.id }, data });

          // Log inventory movement if stock changed
          if (data.stock !== undefined) {
            const prev = currentStockMap.get(v.id) ?? 0;
            const next = Number(data.stock) ?? prev;
            const delta = next - prev;
            if (delta !== 0) {
              await tx.inventoryMovements.create({
                data: {
                  productId: id,
                  variantId: v.id,
                  delta,
                  reason: "manualAdjust",
                  note: "adminEdit",
                },
              });
            }
          }
        } else {
          // create new
          const colorName = (v.color || "").trim();
          if (!colorName) continue;
          const stockVal = toIntStrict(v.stock) ?? 0;
          const newVariantId = randomUUID();
          await tx.productVariants.create({
            data: {
              id: newVariantId,
              productId: id,
              color: colorName,
              stock: stockVal,
              images: Array.from(new Set(rawIncoming)),
              colorHexLegacy: colorHexLegacy || null,
              swatchUrlLegacy: swatchUrlLegacy || null,
            },
          });

          // Initial stock movement (so rebuild-onhand stays consistent)
          if (stockVal !== 0) {
            await tx.inventoryMovements.create({
              data: {
                productId: id,
                variantId: newVariantId,
                delta: stockVal,
                reason: "manualAdjust",
                note: "adminEdit:newVariant",
              },
            });
          }
        }
      }
    });

    return res.redirect(303, `/admin/products/${id}`);
  } catch (err) {
    console.error("Update product (upsert variants) failed.", err);
    if (!res.headersSent) {
      res
        .status(500)
        .send(
          "Cập nhật sản phẩm thất bại. Nếu bạn vừa xóa biến thể, có thể biến thể đang được tham chiếu trong giỏ hàng/đơn hàng/kho. Vui lòng kiểm tra và thử lại."
        );
    }
  }
};
// controllers/admin/products.controller.ts
export const softDeleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.products.update({
      where: { id },
      data: { deleted: true, updatedAt: new Date() },
    });
    res.redirect("/admin/products?deleted=1");
  } catch (err) {
    console.error("Soft delete failed.", err);
    res.status(500).send("Delete failed.");
  }
};

// ===== (Optional) TOGGLE STATUS: POST /admin/products/:id/toggle-status
export const toggleStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const row = await prisma.products.findUnique({ where: { id }, select: { status: true } });
    if (!row) return res.status(404).send("Not found");
    const next = row.status === "active" ? "inactive" : "active";
    await prisma.products.update({ where: { id }, data: { status: next, updatedAt: new Date() } });
    res.redirect("/admin/products?statusChanged=1");
  } catch (err) {
    console.error("Toggle status failed.", err);
    res.status(500).send("Toggle failed.");
  }
};


