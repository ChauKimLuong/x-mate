import { Request, Response } from "express";
import prisma from "../../config/database";
import bcrypt from "bcrypt";
import { hash } from "crypto";

// [GET] /user/info
export const info = async (req: Request, res: Response) => {
    try {
        const user = await prisma.users.findFirst({
            where: {
                status: "active",
                token_user: "tok_izr1yfxb5q",
            },
            select: {
                id: true,
                full_name: true,
                phone: true,
                gender: true,
                dob: true,
                weight_kg: true,
                height_cm: true,
                email: true,
            },
        });

        if (!user) {
            return res
                .status(404)
                .render("client/pages/user/info", { userInfo: null });
        }

        res.render("client/pages/user/info", {
            user: user,
        });
    } catch (error) {
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
};

// [GET] /user/address
export const address = async (req: Request, res: Response) => {
    try {
        const user = await prisma.users.findFirst({
            where: {
                status: "active",
                token_user: "tok_izr1yfxb5q",
            },
            select: {
                address: true,
            },
        });
        res.render("client/pages/user/address", {
            user: user,
        });
    } catch (error) {
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
};
// [POST] /user/update-info
export const updateInfo = async (req: Request, res: Response) => {
    try {
        const fullName = req.body.full_name;
        const dob = req.body.dob;
        const gender = req.body.gender;
        const phone = req.body.phone;
        const height_cm = req.body.height_cm;
        const weight_kg = req.body.weight_kg;

        if (
            !fullName ||
            !dob ||
            !gender ||
            !phone ||
            !height_cm ||
            !weight_kg
        ) {
            req.flash("error", "Vui lòng điền đầy đủ thông tin!");
            res.redirect(req.get("Referer") || "/");
        }
        await prisma.users.update({
            where: { token_user: "tok_izr1yfxb5q" },
            data: {
                full_name: fullName,
                dob: new Date(dob),
                gender,
                phone,
                height_cm: Number(height_cm),
                weight_kg: Number(weight_kg),
            },
        });
        req.flash("success", "Cập nhật thông tin thành công!");
        res.redirect(req.get("Referer") || "/user/info");
    } catch (error) {
        req.flash("error", "Có lỗi xảy ra khi cập nhật.");
        res.redirect(req.get("Referer") || "/user/info");
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
};
// [POST] /user/changePassword
export const changePassword = async (req: Request, res: Response) => {
    try {
        const oldPassword = req.body.old_password;
        const newPassword = req.body.new_password;
        const confirmPassword = req.body.confirm_password;
        console.log(oldPassword, newPassword, confirmPassword);

        if (!oldPassword || !newPassword || !confirmPassword) {
            req.flash("error", "Vui lòng điền đầy đủ thông tin!");
            return res.redirect(req.get("Referer") || "/user/info");
        }

        const user = await prisma.users.findUnique({
            where: { token_user: "tok_izr1yfxb5q" },
        });

        if (!user) {
            req.flash("error", "Không tìm thấy tài khoản!");
            return res.redirect(req.get("Referer") || "/user/info");
        }

        const match = await bcrypt.compare(oldPassword, user.password);
        if (!match) {
            req.flash("error", "Mật khẩu cũ không đúng!");
            return res.redirect(req.get("Referer") || "/user/info");
        }

        if (newPassword !== confirmPassword) {
            req.flash("error", "Xác nhận mật khẩu không khớp!");
            return res.redirect(req.get("Referer") || "/user/info");
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        await prisma.users.update({
            where: { token_user: "tok_izr1yfxb5q" },
            data: { password: hashedNewPassword }
        })

        req.flash("success", "Đổi mật thành công!");
        return res.redirect(req.get("Referer") || "/user/info");
    } catch (error) {
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
        req.flash("error", "Có lỗi xảy ra!");
        return res.redirect(req.get("Referer") || "/user/info");
    }
};
