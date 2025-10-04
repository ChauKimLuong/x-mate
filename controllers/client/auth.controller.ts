import { Request, Response } from "express";
import prisma from "../../config/database";
import bcrypt from "bcrypt";

// [GET] /auth/login
export const login = async (req: Request, res: Response) => {
    res.render("client/pages/user/login");
};

// [POST] /auth/login
export const loginPost = async (req: Request, res: Response) => {
    const { phoneOrEmail, password } = req.body;
    console.log(req.body)
    try {
        if (!phoneOrEmail || !password) {
            req.flash("error", "Vui lòng nhập đầy đủ thông tin đăng nhập!");
            return res.redirect("/auth/login");
        }

        const user = await prisma.users.findFirst({
            where: {
                OR: [
                    { email: phoneOrEmail },
                    { phone: phoneOrEmail },
                ],
            },
        });

        if (!user) {
            req.flash("error", "Email/SĐT không tồn tại!");
            return res.redirect("/auth/login");
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            req.flash("error", "Mật khẩu không chính xác!");
            return res.redirect("/auth/login");
        }

        req.flash("success", "Đăng nhập thành công!");
        return res.redirect("/");
    } catch (error) {
        console.error("ERROR:", error);
        req.flash("error", "Đăng nhập thất bại, vui lòng thử lại sau!");
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
                OR: [
                    { email: email },
                    { phone: phone },
                ],
            },
        });

        if (existedUser) {
            req.flash("error", "Email hoặc số điện thoại đã tồn tại!");
            return res.redirect("/auth/register");
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.users.create({
            data: {
                full_name: fullName,
                phone: phone,
                email: email,
                password: hashedPassword,
                token_user: `tok_${Math.random().toString(36).slice(2, 14)}`,
            },
        });

        req.flash("success", "Đăng ký thành công! Đăng nhập để tiếp tục.");
        return res.redirect("/auth/login");
    } catch (error) {
        console.error("ERROR:", error);
        req.flash("error", "Đăng ký thất bại, vui lòng thử lại sau!");
        return res.redirect("/auth/register");
    }
};

