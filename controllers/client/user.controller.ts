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
        const tokenUser = "tok_izr1yfxb5q";
        const addressRows = await prisma.addresses.findMany({
            where: { token_user: tokenUser },
            orderBy: [{ is_default: "desc" }, { updated_at: "desc" }],
        });

        const addresses = addressRows.map((item) => ({
            id: item.id,
            fullName: item.full_name,
            phone: item.phone,
            city: item.city,
            district: item.district,
            ward: item.ward,
            line1: item.line1,
            line2: (item as any).line2 ?? undefined,
            isDefault: item.is_default,
        }));

        res.render("client/pages/user/address", {
            addresses,
        });
    } catch (error) {
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
};

// [GET] /user/voucher
export const voucher = async (req: Request, res: Response) => {
    try {
        const coupons = await prisma.coupons.findMany({
            where: { status: "ACTIVE" },
            orderBy: [
                { enddate: "asc" },
                { createdat: "desc" },
            ],
            select: {
                couponid: true,
                code: true,
                title: true,
                enddate: true,
                usagelimit: true,
                usedcount: true,
                minordervalue: true,
                discountvalue: true,
            },
        });

        const formatAmount = (value: any) => {
            if (value === undefined || value === null) return null;
            const numberValue =
                typeof value === "number" ? value : Number(value.toString());
            if (!Number.isFinite(numberValue)) return null;

            if (numberValue >= 1000 && numberValue % 1000 === 0) {
                const thousand = numberValue / 1000;
                if (Number.isInteger(thousand)) {
                    return `${thousand}K`;
                }
            }
            return new Intl.NumberFormat("vi-VN").format(numberValue);
        };

        const formatDate = (date: Date | null | undefined) => {
            if (!date) return "Không giới hạn";
            return new Intl.DateTimeFormat("vi-VN").format(date);
        };

        const vouchers = coupons.map((coupon) => {
            const remaining =
                typeof coupon.usagelimit === "number"
                    ? Math.max(coupon.usagelimit - coupon.usedcount, 0)
                    : null;

            let description = coupon.title?.trim();
            if (!description || description.length === 0) {
                const discountText = formatAmount(coupon.discountvalue);
                const minOrderText = formatAmount(coupon.minordervalue);
                if (discountText && minOrderText) {
                    description = `Giảm ${discountText} cho đơn từ ${minOrderText}`;
                } else if (discountText) {
                    description = `Giảm ${discountText} cho đơn hàng`;
                } else {
                    description = "Ưu đãi hấp dẫn đang chờ bạn";
                }
            }

            return {
                id: coupon.couponid,
                code: coupon.code,
                description,
                remaining,
                expiryText: formatDate(coupon.enddate),
                termsUrl: "#",
            };
        });

        res.render("client/pages/user/voucher", {
            vouchers,
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
            data: { password: hashedNewPassword },
        });

        req.flash("success", "Đổi mật thành công!");
        return res.redirect(req.get("Referer") || "/user/info");
    } catch (error) {
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
        req.flash("error", "Có lỗi xảy ra!");
        return res.redirect(req.get("Referer") || "/user/info");
    }
};

// [POST] /user/address
export const addressPost = async (req: Request, res: Response) => {
    try {
        const { full_name, phone, city, district, ward, line1 } = req.body;

        if (!full_name || !phone || !city || !district || !ward || !line1) {
            req.flash("error", "Vui lòng điền đầy đủ thông tin!");
            return res.redirect(req.get("Referer") || "/user/address");
        }

        const isDefault: boolean =
            req.body.isDefault === "on" ||
            req.body.isDefault === "true" ||
            req.body.isDefault === true;

        const tokenUser = "tok_izr1yfxb5q";
        if (isDefault) {
            await prisma.addresses.updateMany({
                where: { token_user: tokenUser },
                data: { is_default: false },
            });
        }

        await prisma.addresses.create({
            data: {
                token_user: tokenUser,
                full_name,
                phone,
                city,
                district,
                ward,
                line1,
                is_default: isDefault,
            },
        });

        req.flash("success", "Thêm địa chỉ thành công!");
        return res.redirect(req.get("Referer") || "/user/address");
    } catch (error) {
        console.error("ERROR:", error);
        req.flash("error", "Có lỗi xảy ra!");
        return res.redirect(req.get("Referer") || "/user/address");
    }
};

// [POST] /user/address/update
export const addressUpdate = async (req: Request, res: Response) => {
    try {
        const { id, full_name, phone, city, district, ward, line1 } = req.body;

        const addressId = Number(id);
        if (!addressId || Number.isNaN(addressId)) {
            req.flash("error", "Không tìm thấy địa chỉ cần cập nhật!");
            return res.redirect(req.get("Referer") || "/user/address");
        }

        const fullName = typeof full_name === "string" ? full_name.trim() : "";
        const phoneNumber = typeof phone === "string" ? phone.trim() : "";
        const cityName = typeof city === "string" ? city.trim() : "";
        const districtName =
            typeof district === "string" ? district.trim() : "";
        const wardName = typeof ward === "string" ? ward.trim() : "";
        const addressLine = typeof line1 === "string" ? line1.trim() : "";

        if (
            !fullName ||
            !phoneNumber ||
            !cityName ||
            !districtName ||
            !wardName ||
            !addressLine
        ) {
            req.flash("error", "Vui lòng điền đầy đủ thông tin!");
            return res.redirect(req.get("Referer") || "/user/address");
        }

        const isDefault: boolean =
            req.body.isDefault === "on" ||
            req.body.isDefault === "true" ||
            req.body.isDefault === true;

        const tokenUser = "tok_izr1yfxb5q";

        const existingAddress = await prisma.addresses.findFirst({
            where: { id: addressId, token_user: tokenUser },
        });

        if (!existingAddress) {
            req.flash("error", "Không tìm thấy địa chỉ cần cập nhật!");
            return res.redirect(req.get("Referer") || "/user/address");
        }

        if (isDefault) {
            await prisma.addresses.updateMany({
                where: { token_user: tokenUser },
                data: { is_default: false },
            });
        }

        await prisma.addresses.update({
            where: { id: addressId },
            data: {
                full_name: fullName,
                phone: phoneNumber,
                city: cityName,
                district: districtName,
                ward: wardName,
                line1: addressLine,
                is_default: isDefault,
                updated_at: new Date(),
            },
        });

        req.flash("success", "Cập nhật địa chỉ thành công!");
        return res.redirect(req.get("Referer") || "/user/address");
    } catch (error) {
        console.error("ERROR:", error);
        req.flash("error", "Có lỗi xảy ra!");
        return res.redirect(req.get("Referer") || "/user/address");
    }
};

// [POST] /user/address/default/:id
export const addressDefault = async (req: Request, res: Response) => {
    try {
        const addressId = Number(req.params.addressId);

        await prisma.addresses.updateMany({
            where: {
                NOT: { id: addressId },
            },
            data: {
                is_default: false,
            },
        });

        await prisma.addresses.update({
            where: { id: addressId },
            data: { is_default: true },
        });

        req.flash("success", "Cập nhật địa chỉ thành công!");
        return res.redirect(req.get("Referer") || "/user/address");
    } catch (error) {
        console.error("ERROR:", error);
        req.flash("error", "Có lỗi xảy ra!");
        return res.redirect(req.get("Referer") || "/user/address");
    }
};

// [POST] /user/address/delete/:id
export const addressDelete = async (req: Request, res: Response) => {
    try {
        const addressId = Number(req.params.addressId);

        await prisma.addresses.delete({
            where: {
                id: addressId,
            }
        });

        req.flash("success", "Xóa địa chỉ thành công!");
        return res.redirect(req.get("Referer") || "/user/address");
    } catch (error) {
        console.error("ERROR:", error);
        req.flash("error", "Có lỗi xảy ra!");
        return res.redirect(req.get("Referer") || "/user/address");
    }
};
