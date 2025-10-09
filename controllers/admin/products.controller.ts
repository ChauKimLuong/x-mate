import { Request, Response } from "express";
import prisma from "../../config/database";

const formatMoney = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;

function getRange(range?: string) {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (range === "today") {
    const s = startOfDay(now);
    const e = new Date(s); e.setDate(e.getDate() + 1);
    return { s, e, label: "Today" };
  }
  if (range === "week") {
    // ISO week (Mon-Sun)
    const d = new Date(now);
    const day = d.getDay() || 7; // Sun=0 -> 7
    const s = startOfDay(new Date(d));
    s.setDate(s.getDate() - (day - 1)); // về thứ 2
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

export const getProducts = async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const take = Math.min(50, Number(req.query.take) || 10);
  const skip = (page - 1) * take;

  const range = String(req.query.range || "month"); // today | week | month | year
  const { s, e, label } = getRange(range);

  // lọc theo ngày tạo product; nếu bạn muốn lọc theo orders hãy nói, mình đổi sang aggregate orders
  const createdFilter = { createdAt: { gte: s, lt: e } };

  const [rows, total] = await Promise.all([
    prisma.products.findMany({
      where: { deleted: false, ...createdFilter },
      include: {
        categories: { select: { title: true } },
        productVariants: { select: { stock: true, images: true, color: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.products.count({ where: { deleted: false, ...createdFilter } }),
  ]);

  const products = rows.map((p) => {
    const stockLeft = p.productVariants.reduce((s, v) => s + (v.stock || 0), 0);
    return {
      id: p.id,
      img: p.thumbnail,
      name: p.title,
      sizes: p.size,
      priceText: formatMoney(p.price),
      left: stockLeft,
      sold: p.soldCount,
      category: p.categories?.title || "—",
      rating: p.ratingAvg,
      reviews: p.ratingCount,
    };
  });

  res.render("admin/pages/products/list", {
    title: "Product List",
    active: "products",
    products,
    pagination: { page, take, total },
    filterLabel: label,
    range, // để biết cái nào đang active
  });
};
