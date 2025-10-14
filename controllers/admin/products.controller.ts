// controllers/admin/products.controller.ts
import { Request, Response } from "express";
import prisma from "../../config/database";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";

/* ========= Helpers chung ========= */
const formatMoney = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
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
  if (range === "today") {
    const s = startOfDay(now); const e = new Date(s); e.setDate(e.getDate() + 1);
    return { s, e, label: "Today" };
  }
  if (range === "week") {
    const d = new Date(now); const day = d.getDay() || 7;
    const s = startOfDay(new Date(d)); s.setDate(s.getDate() - (day - 1));
    const e = new Date(s); e.setDate(e.getDate() + 7);
    return { s, e, label: "This Week" };
  }
  if (range === "year") {
    const s = new Date(now.getFullYear(), 0, 1);
    const e = new Date(now.getFullYear() + 1, 0, 1);
    return { s, e, label: "This Year" };
  }
  const s = new Date(now.getFullYear(), now.getMonth(), 1);
  const e = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { s, e, label: "This Month" };
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
  const page = Math.max(1, Number(req.query.page) || 1);
  const take = Math.min(50, Number(req.query.take) || 10);
  const skip = (page - 1) * take;
  const range = String(req.query.range || "month");
  const { s, e, label } = getRange(range);

  const createdFilter = { createdAt: { gte: s, lt: e } };

  const [rows, total] = await Promise.all([
    prisma.products.findMany({
      where: { deleted: false, ...createdFilter },
      include: {
        categories: { select: { title: true } },
        productVariants: {
          select: { stock: true, images: true, color: true }, // cần images để fallback
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.products.count({ where: { deleted: false, ...createdFilter } }),
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
    pagination: { page, take, total },
    filterLabel: label,
    range,
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
          include: { colors: { select: { id: true, name: true, hex: true, swatchUrl: true } } },
          // ⚠️ Bỏ orderBy theo createdAt nếu model không có cột này
          orderBy: { id: 'asc' },
        },
        reviews: { select: { rating: true } },
      },
    });

    if (!row) return res.status(404).render("admin/pages/products/view", { product: null });

    const stockLeft = row.productVariants.reduce((s, v) => s + ((Number(v.stock) || 0)), 0);
    const statusText = row.status === 'inactive' ? 'Inactive' : 'Active';
    const statusClass = row.status === 'inactive' ? 'pv-badge pv-badge--muted' : 'pv-badge pv-badge--ok';

    const viewModel = {
      ...row,
      categoryTitle: row.categories?.title || '—',
      priceText: (Number(row.price)||0).toLocaleString("vi-VN") + "đ",
      stockLeft,
      variantCount: row.productVariants.length,
      images: [ row.thumbnail, ...row.productVariants.flatMap(v => v.images || []) ].filter(Boolean),
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

    const [row, categories] = await Promise.all([
      prisma.products.findUnique({
        where: { id },
        include: {
          productVariants: {
            include: { colors: { select: { id: true, name: true, hex: true, swatchUrl: true } } },
            orderBy: { id: 'asc' },
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

    if (!row) {
      return res.status(404).render("admin/pages/products/edit", {
        title: "Edit Product",
        active: "products",
        product: null,
        categories, // luôn truyền để view không lỗi
      });
    }

    return res.render("admin/pages/products/edit", {
      title: "Edit Product",
      active: "products",
      product: row,      // có row.status
      categories,
    });
  } catch (err) {
    console.error("editProductForm error:", err);
    if (!res.headersSent) res.status(500).send("Internal error.");
  }
};

// ===== UPDATE: POST /admin/products/:id
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const b = req.body as any;
    const files = (req.files as Express.Multer.File[]) || [];

    // ---- fields cơ bản
    const title = (b.title || '').trim();
    const categoryId = (b.categoryId || '').trim();
    const status: "active" | "inactive" = (b.status === "inactive" ? "inactive" : "active");
    const price = Number.isFinite(Number(b.price)) ? Math.trunc(Number(b.price)) : 0;
    const discount = Number.isFinite(Number(b.discount)) ? Math.trunc(Number(b.discount)) : 0;
    const description = typeof b.description === "string" ? b.description : null;

    const sizeRaw = b["size[]"] ?? b.size ?? [];
    const sizes: string[] = Array.isArray(sizeRaw) ? sizeRaw.filter(Boolean) : (sizeRaw ? [String(sizeRaw)] : []);

    // ---- thumbnail
    const thumbnailUrl = (b.thumbnailUrl || '').trim();
    let thumbnail: string | undefined = undefined;
    if (thumbnailUrl) {
      thumbnail = thumbnailUrl;
    } else {
      const thumbFile = files.find((f) => f.fieldname === "thumbnail");
      if (thumbFile) thumbnail = await saveFileToPublic(thumbFile);
    }

    // ---- helpers
    const isHttpUrl = (s: string) => /^https?:\/\//i.test(String(s || '').trim());
    const pushLines = (t: string, into: string[]) =>
      String(t || "")
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((u) => into.push(u));

    // ---- parse variants
    type VItem = {
      id?: string | null;
      _delete?: boolean;
      color?: string;
      stock?: number;
      urls: string[];
      files: Express.Multer.File[];
      colorHexLegacy?: string | null;
      swatchUrlLegacy?: string | null;
      imagesMode?: "append" | "replace"; // <--- thêm
    };
    const variantMap: Record<string, VItem> = {};

    // Nhặt keys dạng variants[IDX][...]
    Object.keys(b).forEach((k) => {
      const m = k.match(
        /^variants\[(\w+)\]\[(id|_delete|color|stock|imageUrls|colorHexLegacy|swatchUrlLegacy|imagesMode)\](?:\[\])?$/
      );
      if (!m) return;
      const idx = m[1];
      const field = m[2] as keyof VItem | "imageUrls";
      const item = (variantMap[idx] ||= { urls: [], files: [] });

      if (field === "imageUrls") {
        const raw = b[k];
        Array.isArray(raw) ? raw.forEach((t: string) => pushLines(t, item.urls)) : raw && pushLines(raw, item.urls);
        return;
      }
      if (field === "stock") {
        item.stock = Number.isFinite(Number(b[k])) ? Math.trunc(Number(b[k])) : 0;
        return;
      }
      if (field === "_delete") {
        const v = b[k];
        item._delete = v === "1" || v === "true" || v === true;
        return;
      }
      if (field === "id") {
        const v = (b[k] || "").trim();
        item.id = v || null;
        return;
      }
      if (field === "imagesMode") {
        const v = String(b[k] || "").toLowerCase();
        item.imagesMode = v === "replace" ? "replace" : "append"; // default append
        return;
      }
      // color / colorHexLegacy / swatchUrlLegacy
      (item as any)[field] = (typeof b[k] === "string" ? b[k].trim() : null);
    });

    // Nhặt files ảnh dạng variants[IDX][images][]
    files.forEach((f) => {
      const m = f.fieldname.match(/^variants\[(\w+)\]\[images\]\[\]$/);
      if (!m) return;
      const idx = m[1];
      (variantMap[idx] ||= { urls: [], files: [] }).files.push(f);
    });

    // ---- ảnh hiện tại để phục vụ "append"
    const current = await prisma.productVariants.findMany({
      where: { productId: id },
      select: { id: true, images: true },
    });
    const currentImgMap = new Map(current.map(v => [v.id, Array.isArray(v.images) ? v.images : []]));

    await prisma.$transaction(async (tx) => {
      // Update product
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

      // Upsert variants
      for (const idx of Object.keys(variantMap)) {
        const v = variantMap[idx];

        // upload files của variant
        const uploadedUrls: string[] = [];
        for (const f of v.files) {
          uploadedUrls.push(await saveFileToPublic(f, "public/uploads/variants"));
        }
        const newCandidateImages = [...v.urls, ...uploadedUrls]; // những gì user vừa nhập/upload
        const mode: "append" | "replace" = v.imagesMode || "append";

        // Ưu tiên swatchUrl hợp lệ -> xoá hex; ngược lại nếu hex hợp lệ -> xoá url
        let colorHexLegacy = (v.colorHexLegacy || "") as string;
        let swatchUrlLegacy = (v.swatchUrlLegacy || "") as string;

        const hexOk = /^#?[0-9a-fA-F]{3}$/.test(colorHexLegacy) || /^#?[0-9a-fA-F]{6}$/.test(colorHexLegacy);
        const urlOk = isHttpUrl(swatchUrlLegacy);

        if (urlOk) {
          colorHexLegacy = "";
        } else if (hexOk) {
          swatchUrlLegacy = "";
        } else {
          colorHexLegacy = "";
          swatchUrlLegacy = "";
        }

        if (v.id) {
          // Cũ
          if (v._delete) {
            await tx.productVariants.delete({ where: { id: v.id } });
            continue;
          }
          const data: any = {};
          if (typeof v.color === "string" && v.color.trim()) data.color = v.color.trim();
          if (typeof v.stock === "number" && v.stock >= 0) data.stock = v.stock;

          data.colorHexLegacy = colorHexLegacy || null;
          data.swatchUrlLegacy = swatchUrlLegacy || null;

          // Ảnh: append hoặc replace (nếu không có input mới => giữ nguyên)
          if (newCandidateImages.length > 0) {
            if (mode === "append") {
              const existing = currentImgMap.get(v.id) || [];
              data.images = [...existing, ...newCandidateImages];
            } else {
              data.images = newCandidateImages; // replace
            }
          }
          await tx.productVariants.update({ where: { id: v.id }, data });
        } else {
          // Mới
          const colorName = (v.color || "").trim();
          if (!colorName) continue;
          const stockVal = Number.isFinite(Number(v.stock)) ? Math.trunc(Number(v.stock)) : 0;

          await tx.productVariants.create({
            data: {
              id: randomUUID(),
              productId: id,
              color: colorName,
              stock: stockVal,
              images: newCandidateImages, // mới thì set theo input
              colorHexLegacy: colorHexLegacy || null,
              swatchUrlLegacy: swatchUrlLegacy || null,
            },
          });
        }
      }
    });

    // đổi theo route view của bạn: /admin/products/:id hoặc /admin/products/:id/view
    res.redirect(`/admin/products/${id}/view`);
  } catch (err) {
    console.error("Update product (upsert variants) failed.", err);
    if (!res.headersSent) res.status(500).send("Update product failed.");
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
