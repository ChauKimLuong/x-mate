import { Request, Response } from "express";
import prisma from "../../config/database";
import bcrypt from "bcrypt";

// [GET] /auth/login
export const login = async (req: Request, res: Response) => {
    res.render("client/pages/user/login");
};

// [POST] /auth/login
export const loginPost = async (req: Request, res: Response) => {
    const { identifier, password } = req.body;
    console.log(req.body);
    try {
        if (!identifier || !password) {
            req.flash("error", "Vui lòng nhập đầy đủ thông tin đăng nhập!");
            return res.redirect("/auth/login");
        }

        const user = await prisma.users.findFirst({
            where: {
                OR: [{ email: identifier }, { phone: identifier }],
            },
        });

        if (!user) {
            req.flash("error", "Email/SDT không tồn tại!");
            return res.redirect("/auth/login");
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            req.flash("error", "Mật khẩu không chính xác!");
            return res.redirect("/auth/login");
        }
        const tokenUser = user.token_user;
        res.cookie("token_user", tokenUser);

        req.flash("success", "Đăng nhập thành công!");
        return res.redirect("/");
    } catch (error) {
        console.error("ERROR:", error);
        req.flash("error", "Đăng nhập thất bại!");
        return res.redirect("/auth/login");
    }
};

// [GET] /auth/register
export const register = async (req: Request, res: Response) => {
    res.render("client/pages/user/register");
};

// [POST] /auth/register
export const registerPost = async (req: Request, res: Response) => {
    try {
        const { fullName, phone, email, password } = req.body;

        if (!fullName || !phone || !email || !password) {
            req.flash("error", "Vui lòng nhập đầy đủ thông tin!");
            return res.redirect("/auth/register");
        }

        const existedUser = await prisma.users.findFirst({
            where: {
                OR: [{ email: email }, { phone: phone }],
            },
        });

        if (existedUser) {
            req.flash("error", "Email hoặc SĐT đã tồn tại!");
            return res.redirect("/auth/register");
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const tokenUser = `tok_${Math.random().toString(36).slice(2, 14)}`;
        await prisma.users.create({
            data: {
                full_name: fullName,
                phone: phone,
                email: email,
                password: hashedPassword,
                token_user: tokenUser,
            },
        });

        res.cookie("token_user", tokenUser);

        req.flash("success", "Đăng kí thành công!");
        return res.redirect("/");
    } catch (error) {
        console.error("ERROR:", error);
        req.flash("error", "Đăng kí thất bại, vui lòng thử lại sau!");
        return res.redirect("/auth/register");
    }
};

// [GET] /auth/logout
export const logout = async (req: Request, res: Response) => {
    try {
        if (!req.cookies || !req.cookies.token_user) {
            req.flash("error", "Bạn chưa đăng nhập!");
            return res.redirect("/auth/login");
        }

        res.clearCookie("token_user");

        req.flash("success", "Đăng xuất thành công!");
        return res.redirect("/auth/login");
    } catch (error) {
        console.error("ERROR:", error);
        req.flash("error", "Đăng xuất thất bại, vui lòng thử lại!");
        return res.redirect(req.get("Referer") || "/");
    }
};
