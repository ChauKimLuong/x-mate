import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/* ============================================================
   🔧 Helper: Format giá trị giảm giá
   ============================================================ */
function formatDiscount(type: string, value: number | null): string {
  const num = Number(value || 0);
  if (type === "PERCENT") return `${num}%`;
  if (type === "AMOUNT") return num.toLocaleString("vi-VN") + " đ";
  if (type === "FREESHIP") return "Free Ship";
  return "-";
}

/* ============================================================
   📄 LIST – Hiển thị danh sách khuyến mãi
   ============================================================ */
export const list = async (_req: Request, res: Response) => {
  try {
    const coupons = await prisma.coupons.findMany({
      orderBy: { createdat: "desc" },
    });

    const formatted = coupons.map(c => ({
      ...c,
      discountText: formatDiscount(c.type, Number(c.discountvalue)),
    }));

    res.render("admin/pages/promotions/list", {
      title: "Promotions",
      active: "promotions",
      coupons: formatted,
    });
  } catch (err) {
    console.error("❌ Error loading promotions:", err);
    res.status(500).send("Error loading promotions");
  }
};

/* ============================================================
   ➕ CREATE FORM – Trang thêm mới
   ============================================================ */
export const createForm = (_req: Request, res: Response) => {
  res.render("admin/pages/promotions/form", {
    title: "Add Promotion",
    active: "promotions",
    mode: "create",
    form: {
      code: "",
      title: "",
      type: "PERCENT",
      discountvalue: 0,
      startdate: "",
      enddate: "",
      status: "ACTIVE",
    },
  });
};

/* ============================================================
   ✏️ EDIT FORM – Trang chỉnh sửa
   ============================================================ */
export const editForm = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const promo = await prisma.coupons.findUnique({
      where: { couponid: id },
    });

    if (!promo) {
      return res.status(404).send("Promotion not found");
    }

    res.render("admin/pages/promotions/form", {
      title: "Edit Promotion",
      active: "promotions",
      mode: "edit",
      form: promo,
    });
  } catch (err) {
    console.error("❌ Error loading promotion:", err);
    res.status(500).send("Error loading promotion");
  }
};

/* ============================================================
   💾 CREATE – Lưu dữ liệu khi thêm mới
   ============================================================ */
export const create = async (req: Request, res: Response) => {
  try {
    const { code, title, type, discount, start, end, status,
            usagelimit, minordervalue, maxdiscount } = req.body;

    // Chuẩn hóa input
    const nDiscount      = parseFloat(discount) || 0;
    const nUsageLimit    = usagelimit === '' ? null : Number.parseInt(usagelimit, 10);
    const nMinOrderValue = minordervalue === '' ? null : parseFloat(minordervalue);
    const nMaxDiscount   = maxdiscount === '' ? null : parseFloat(maxdiscount);

    // (tuỳ chọn) Validate cơ bản
    if (type === 'PERCENT' && (nDiscount < 0 || nDiscount > 100)) {
      return res.status(400).send('Percent must be between 0 and 100');
    }
    if (type === 'AMOUNT' && nDiscount < 0) {
      return res.status(400).send('Fixed amount must be >= 0');
    }
    if (nUsageLimit !== null && nUsageLimit < 0) {
      return res.status(400).send('Usage limit must be >= 0');
    }
    if (nMinOrderValue !== null && nMinOrderValue < 0) {
      return res.status(400).send('Min order value must be >= 0');
    }
    if (nMaxDiscount !== null && nMaxDiscount < 0) {
      return res.status(400).send('Max discount must be >= 0');
    }

    await prisma.coupons.create({
      data: {
        code,
        title,
        type,
        discountvalue: type === 'FREESHIP' ? 0 : nDiscount,
        startdate: start ? new Date(start) : null,
        enddate: end ? new Date(end) : null,
        status: status || 'INACTIVE',
        usagelimit: nUsageLimit,
        minordervalue: nMinOrderValue,
        maxdiscount: nMaxDiscount,
      },
    });

    res.redirect('/admin/promotions');
  } catch (err) {
    console.error('❌ Error creating promotion:', err);
    res.status(500).send('Error creating promotion');
  }
};

/* ============================================================
   🔁 UPDATE – Cập nhật khuyến mãi
   ============================================================ */
export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { code, title, type, discount, start, end, status,
            usagelimit, minordervalue, maxdiscount } = req.body;

    const nDiscount      = parseFloat(discount) || 0;
    const nUsageLimit    = usagelimit === '' ? null : Number.parseInt(usagelimit, 10);
    const nMinOrderValue = minordervalue === '' ? null : parseFloat(minordervalue);
    const nMaxDiscount   = maxdiscount === '' ? null : parseFloat(maxdiscount);

    // (tuỳ chọn) Validate như trên…

    await prisma.coupons.update({
      where: { couponid: id },
      data: {
        code,
        title,
        type,
        discountvalue: type === 'FREESHIP' ? 0 : nDiscount,
        startdate: start ? new Date(start) : null,
        enddate: end ? new Date(end) : null,
        status: status || 'INACTIVE',
        usagelimit: nUsageLimit,
        minordervalue: nMinOrderValue,
        maxdiscount: nMaxDiscount,
        updatedat: new Date(),
      },
    });

    res.redirect('/admin/promotions');
  } catch (err) {
    console.error('❌ Error updating promotion:', err);
    res.status(500).send('Error updating promotion');
  }
};

/* ============================================================
   🗑️ DELETE – Xóa khuyến mãi
   ============================================================ */
export const remove = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await prisma.coupons.delete({
      where: { couponid: id },
    });
    res.redirect("/admin/promotions");
  } catch (err) {
    console.error("❌ Error deleting promotion:", err);
    res.status(500).send("Error deleting promotion");
  }
};
