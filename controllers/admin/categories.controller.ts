// controllers/admin/categories.controller.ts
import { Request, Response } from "express";
import prisma from "../../config/database";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";

const val = (v?: any) => (typeof v === "string" ? v.trim() : v);

// simple slugify similar to products
const slugify = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "danh-muc";

async function uniqueSlug(base: string) {
  let slug = base;
  let i = 1;
  const candidates = await prisma.categories.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const taken = new Set(candidates.map((x) => x.slug));
  while (taken.has(slug)) slug = `${base}-${++i}`;
  return slug;
}

async function saveFileToPublic(file: Express.Multer.File, destDir = "public/uploads") {
  const ext = (file.originalname.split(".").pop() || "bin").toLowerCase().split("?")[0];
  const id = randomUUID();
  const rel = `${destDir}/${id}.${ext}`;
  const abs = path.join(process.cwd(), rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, file.buffer);
  return "/" + rel.replace(/^public\//, "");
}

// GET /admin/categories
export const getCategories = async (req: Request, res: Response) => {
  const allMode = String(req.query.take || '').toLowerCase() === 'all'
    || String(req.query.all || '') === '1';
  const page = Math.max(1, Number(req.query.page) || 1);
  const take = allMode ? undefined : Math.min(50, Number(req.query.take) || 10);
  const skip = allMode ? undefined : (page - 1) * (take as number);
  const keyword = String(req.query.q || '').trim();

  const where: any = { deleted: false };
  if (keyword) {
    where.title = { contains: keyword, mode: 'insensitive' } as any;
  }

  const findOpts: any = {
    where,
    orderBy: [ { position: 'asc' as const }, { createdAt: 'desc' as const } ],
  };
  if (!allMode) { findOpts.skip = skip; findOpts.take = take; }

  const [rows, total] = await Promise.all([
    prisma.categories.findMany(findOpts),
    prisma.categories.count({ where }),
  ]);

  const categories = rows.map((c) => ({
    id: c.id,
    title: c.title,
    position: c.position,
    status: c.status,
    isFeatured: c.isFeatured,
    createdAt: c.createdAt,
    thumbnail: c.thumbnail || "/images/placeholder.jpg",
  }));

  res.render("admin/pages/categories/list", {
    title: "Category List",
    active: "categories:list",
    categories,
    pagination: { page, take: (allMode ? total : (take as number) || 10), total },
    allMode,
    keyword,
  });
};

// GET /admin/categories/create
export const showCreateCategory = async (_req: Request, res: Response) => {
  const parents = await prisma.categories.findMany({
    where: { deleted: false, status: 'active' },
    select: { id: true, title: true },
    orderBy: { title: 'asc' },
  });
  res.render("admin/pages/categories/create", { title: "Create Category", active: "categories:create", parents });
};

// POST /admin/categories
export const createCategory = async (req: Request, res: Response) => {
  try {
    const b = req.body as any;
    const files = (req.files as Express.Multer.File[]) || [];

    const title = val(b.title);
    const parentId = val(b.parentId) || null;
    const description = val(b.description) || null;
    const status: "active" | "inactive" = (b.status === "inactive" ? "inactive" : "active");
    const isFeatured = String(b.isFeatured) === 'on' || String(b.isFeatured) === '1';
    const position = Number.isFinite(Number(b.position)) ? Math.trunc(Number(b.position)) : 0;

    const thumbUrl = val(b.thumbnailUrl);
    let thumbnail = "";
    if (thumbUrl) thumbnail = thumbUrl;
    else {
      const f = files.find((x) => x.fieldname === 'thumbnail');
      if (f) thumbnail = await saveFileToPublic(f);
    }

    if (!title) return res.status(400).send("Missing title");

    const baseSlug = slugify(String(title));
    const slug = await uniqueSlug(baseSlug);
    const id = randomUUID();

    await prisma.categories.create({
      data: {
        id,
        title: String(title),
        parentId: parentId || undefined,
        description,
        thumbnail: thumbnail || null,
        status,
        isFeatured,
        slug,
        position,
      },
    });

    res.redirect(303, "/admin/categories");
  } catch (err) {
    console.error("Create category failed", err);
    res.status(500).send("Create failed");
  }
};

// GET /admin/categories/:id/edit
export const editCategoryForm = async (req: Request, res: Response) => {
  const { id } = req.params;
  const row = await prisma.categories.findUnique({ where: { id } });
  if (!row || row.deleted) return res.status(404).send("Not found");
  const parents = await prisma.categories.findMany({
    where: { deleted: false, status: 'active', NOT: { id } },
    select: { id: true, title: true },
    orderBy: { title: 'asc' },
  });
  res.render("admin/pages/categories/edit", { title: "Edit Category", active: "categories:list", row, parents });
};

// POST /admin/categories/:id
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const b = req.body as any;
    const files = (req.files as Express.Multer.File[]) || [];

    const title = val(b.title);
    const parentId = val(b.parentId) || null;
    const description = val(b.description) || null;
    const status: "active" | "inactive" = (b.status === "inactive" ? "inactive" : "active");
    const isFeatured = String(b.isFeatured) === 'on' || String(b.isFeatured) === '1';
    const position = Number.isFinite(Number(b.position)) ? Math.trunc(Number(b.position)) : 0;

    const thumbUrl = val(b.thumbnailUrl);
    let thumbnail: string | undefined = undefined;
    if (thumbUrl) thumbnail = thumbUrl;
    else {
      const f = files.find((x) => x.fieldname === 'thumbnail');
      if (f) thumbnail = await saveFileToPublic(f);
    }

    const data: any = {
      title: String(title || ""),
      parentId: parentId || undefined,
      description,
      status,
      isFeatured,
      position,
      updatedAt: new Date(),
    };
    if (thumbnail) data.thumbnail = thumbnail;

    await prisma.categories.update({ where: { id }, data });
    res.redirect(303, "/admin/categories");
  } catch (err) {
    console.error("Update category failed", err);
    res.status(500).send("Update failed");
  }
};

// POST /admin/categories/:id/delete
export const softDeleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.categories.update({ where: { id }, data: { deleted: true, deletedAt: new Date(), updatedAt: new Date() } });
    res.redirect("/admin/categories?deleted=1");
  } catch (err) {
    console.error("Delete category failed", err);
    res.status(500).send("Delete failed");
  }
};

// POST /admin/categories/:id/toggle-status
export const toggleStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const row = await prisma.categories.findUnique({ where: { id }, select: { status: true } });
    if (!row) return res.status(404).send("Not found");
    const next = row.status === "active" ? "inactive" : "active";
    await prisma.categories.update({ where: { id }, data: { status: next, updatedAt: new Date() } });
    res.redirect("/admin/categories");
  } catch (err) {
    console.error("Toggle category status failed", err);
    res.status(500).send("Toggle failed");
  }
};
