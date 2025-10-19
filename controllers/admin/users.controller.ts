import { Request, Response } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import bcrypt from "bcrypt";
const prisma = new PrismaClient();

/* ============================
   📋 Danh sách người dùng
   ============================ */
export const list = async (req: Request, res: Response) => {
  try {
    const filter = (req.query.role as string) || "All";

    // Lấy danh sách roles
    const allRoles = await prisma.roles.findMany();
    let where: any = {};

    if (filter !== "All") {
      const selectedRole = allRoles.find(r => r.name.toLowerCase() === filter.toLowerCase());
      if (selectedRole) {
        where = { role: selectedRole.id }; // role là UUID
      }
    }

    const users = await prisma.users.findMany({
      where,
      include: { roles: true },
      orderBy: { created_at: "desc" },
    });

    const counts = {
      all: await prisma.users.count(),
      admin: await prisma.users.count({ where: { role: allRoles.find(r => r.name === "admin")?.id } }),
      staff: await prisma.users.count({ where: { role: allRoles.find(r => r.name === "staff")?.id } }),
      customer: await prisma.users.count({ where: { role: allRoles.find(r => r.name === "customer")?.id } }),
    };

    res.render("admin/pages/users/list", {
      title: "Users",
      active: "users",
      users,
      filter,
      counts,
    });
  } catch (err) {
    const anyErr: any = err as any;
    if (anyErr?.code === 'P2002' && Array.isArray(anyErr?.meta?.target) && anyErr.meta.target.includes('email')) {
      (req as any).flash?.('error', 'Email đã tồn tại');
      return res.redirect('/admin/users/create');
    }
    console.error("❌ Error loading users:", err);
    res.status(500).send("Error loading users");
  }
};



/* ============================
   ➕ Form thêm nhân viên
   ============================ */
export const createForm = async (req: Request, res: Response) => {
  try {
    const roles = await prisma.roles.findMany();
    res.render("admin/pages/users/form", {
      title: "Add Staff",
      active: "users",
      mode: "create",
      form: {},
      roles,
    });
  } catch (err) {
    console.error("❌ Error loading create form:", err);
    res.status(500).send("Error loading form");
  }
};

/* ============================
   💾 Tạo nhân viên
   ============================ */
export const create = async (req: Request, res: Response) => {
  try {
    let { full_name, email, password, phone, gender, role } = req.body;
    const token_user = `tok_${nanoid(10)}`;

    // 🔤 Chuẩn hóa Gender: Nam/Nữ hoặc null
    if (gender === "Nam" || gender === "Nữ") {
      gender = gender;
    } else {
      gender = null;
    }

    // Chuẩn hoá email + hash password trước khi lưu
    email = String(email || '').toLowerCase();
    password = await bcrypt.hash(String(password || ''), 10);

    // Map role name -> UUID id if needed
    if (role && typeof role === 'string' && role.indexOf('-') === -1) {
      const r = await prisma.roles.findFirst({ where: { name: role } });
      if (r) role = r.id;
    }

    await prisma.users.create({
      data: {
        full_name,
        email,
        password,
        phone,
        gender,
        role,
        token_user,
        status: "active",
      },
    });

    res.redirect("/admin/users");
  } catch (err) {
    console.error("❌ Error creating user:", err);
    res.status(500).send("Error creating user");
  }
};

/* ============================
   ✏️ Form chỉnh sửa
   ============================ */
export const editForm = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const user = await prisma.users.findUnique({
      where: { id },
      include: { roles: true },
    });
    const roles = await prisma.roles.findMany();

    if (!user) return res.status(404).send("User not found");

    res.render("admin/pages/users/form", {
      title: "Edit User",
      active: "users",
      mode: "edit",
      form: user,
      roles,
    });
  } catch (err) {
    console.error("❌ Error loading edit form:", err);
    res.status(500).send("Error loading user form");
  }
};

/* ============================
   🔁 Cập nhật
   ============================ */
export const update = async (req: Request, res: Response) => {
  try {
    const { full_name, email, phone, status, role, gender, password } = req.body as any;
    const id = req.params.id;

    // Map gender to valid values ('Nam' | 'Nữ' | null)
    let genderMapped: string | null = null;
    if (typeof gender === 'string') {
      const g = gender.trim().toLowerCase();
      if (g === 'nam' || g === 'male') genderMapped = 'Nam';
      else if (g === 'nữ' || g === 'nu' || g === 'female') genderMapped = 'Nữ';
      else if (g === 'nam' || g === 'nữ') genderMapped = gender as string;
      else genderMapped = null;
    }

    const updateData: any = { full_name, email: email ? String(email).toLowerCase() : undefined, phone, status, role, gender: genderMapped };
    if (password && String(password).trim() !== "") {
      updateData.password = await bcrypt.hash(String(password), 10);
    }
    await prisma.users.update({ where: { id }, data: updateData });

    res.redirect("/admin/users");
  } catch (err) {
    console.error("❌ Error updating user:", err);
    res.status(500).send("Error updating user");
  }
};

/* ============================
   🗑️ Xóa mềm (đánh dấu deleted)
   ============================ */
export const remove = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    await prisma.users.update({
      where: { id },
      data: { deleted: true, deleted_at: new Date(), status: "inactive" },
    });
    res.redirect("/admin/users");
  } catch (err) {
    console.error("❌ Error deleting user:", err);
    res.status(500).send("Error deleting user");
  }
};
