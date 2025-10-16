import { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../../config/database";

export const getLogin = async (req: Request, res: Response) => {
  if (req.session && (req.session as any).admin) {
    return res.redirect("/admin/dashboard");
  }
  return res.render("admin/pages/log/login");
};

export const postLogin = async (req: Request, res: Response) => {
  try {
    const { email, password, remember } = req.body as { email?: string; password?: string; remember?: string };

    if (!email || !password) {
      req.flash("error", "Vui lòng nhập email và mật khẩu");
      return res.redirect("/admin/login");
    }

    const user = await prisma.users.findFirst({
      where: { email },
      include: { roles: true },
    });

    if (!user) {
      req.flash("error", "Tài khoản không tồn tại");
      return res.redirect("/admin/login");
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      req.flash("error", "Mật khẩu không chính xác");
      return res.redirect("/admin/login");
    }

    const roleName = user.roles?.name?.toLowerCase();
    const allowed = roleName === "admin" || roleName === "staff";
    if (!allowed) {
      req.flash("error", "Bạn không có quyền truy cập trang quản trị");
      return res.redirect("/admin/login");
    }

    (req.session as any).admin = {
      id: user.id,
      email: user.email,
      role: roleName,
      full_name: user.full_name,
      avatar: user.avatar || null,
    };

    // Remember me: keep session 7 days if checked
    if (remember) {
      req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    }

    return req.session.save(() => res.redirect("/admin/dashboard"));
  } catch (err) {
    console.error("Admin login error:", err);
    req.flash("error", "Đăng nhập thất bại, vui lòng thử lại");
    return res.redirect("/admin/login");
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    req.session.destroy(() => {
      res.redirect("/admin/login");
    });
  } catch {
    return res.redirect("/admin/login");
  }
};
