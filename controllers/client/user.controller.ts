import { Request, Response } from "express";
import prisma from "../../config/database";
import bcrypt from "bcrypt";

// [GET] /user/info
export const info = async (req: Request, res: Response) => {
    try {
        const token = req.cookies?.token_user;
        console.log("Token from cookies:", token);
        if (!token) {
            req.flash("error", "Vui lòng đăng nhập để xem thông tin.");
            return res.redirect("/auth/login");
        }

        const user = await prisma.users.findFirst({
            where: {
                status: "active",
                token_user: token,
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
            req.flash("error", "Tài khoản không tồn tại.");
            return res.redirect("/auth/login");
        }

        return res.render("client/pages/user/info", { user });
    } catch (error) {
        req.flash("error", "Vui lòng đăng nhập để xem thông tin.");
        res.redirect("/auth/login");
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
};

// [GET] /user/address
export const address = async (req: Request, res: Response) => {
    try {
        const addressRows = await prisma.addresses.findMany({
            where: { token_user: req.cookies.token_user },
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
        req.flash("error", "Vui lòng đăng nhập để xem thông tin.");
        res.redirect("/auth/login");
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
};

// [GET] /user/order
export const order = async (req: Request, res: Response) => {
    const token = req.cookies?.token_user;
    if (!token) {
        req.flash("error", "Vui lòng đăng nhập để xem đơn hàng.");
        return res.redirect("/auth/login");
    }

    const toNumber = (value: unknown): number => {
        if (value === null || value === undefined) return 0;
        if (typeof value === "number") return value;
        if (typeof value === "bigint") return Number(value);
        if (typeof value === "string") {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : 0;
        }
        if (value && typeof value === "object" && "toString" in value) {
            const parsed = Number((value as any).toString());
            return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
    };

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
            maximumFractionDigits: 0,
        }).format(Math.max(0, Math.round(amount)));

    const formatDateTime = (value: Date | string | null | undefined) => {
        if (!value) return "";
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return new Intl.DateTimeFormat("vi-VN", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(date);
    };

    const statusMap: Record<
        string,
        { label: string; className: string }
    > = {
        pending: { label: "Chờ xác nhận", className: "is-pending" },
        paid: { label: "Đã thanh toán", className: "is-paid" },
        shipped: { label: "Đang giao", className: "is-shipped" },
        completed: { label: "Hoàn tất", className: "is-completed" },
        cancelled: { label: "Đã hủy", className: "is-cancelled" },
    };

    const paymentMap: Record<string, string> = {
        COD: "Thanh toán khi nhận hàng",
        VIETQR: "Chuyển khoản VietQR",
    };

    try {
        const orders = await prisma.orders.findMany({
            where: { token_user: token },
            orderBy: { created_at: "desc" },
            include: {
                order_items: {
                    include: {
                        products: {
                            select: {
                                title: true,
                                slug: true,
                                thumbnail: true,
                            },
                        },
                    },
                    orderBy: { created_at: "asc" },
                },
            },
        });

        const ordersForView = orders.map((order) => {
            const statusInfo =
                statusMap[order.status] ?? {
                    label: order.status,
                    className: "is-pending",
                };
            const paymentLabel =
                paymentMap[order.payment_method] ?? order.payment_method;

            const items = (order.order_items || []).map((item) => {
                const price = formatCurrency(toNumber(item.price));
                const lineTotal = formatCurrency(toNumber(item.line_total));
                const title = item.products?.title ?? "Sản phẩm";
                const slug = item.products?.slug ?? item.product_slug;
                const thumb =
                    item.thumbnail_snapshot ??
                    item.products?.thumbnail ??
                    "/images/placeholder.png";

                return {
                    id: item.id,
                    title,
                    slug,
                    quantity: item.quantity ?? 0,
                    size: item.size ?? null,
                    color: item.color ?? null,
                    priceText: price,
                    lineTotalText: lineTotal,
                    thumbnail: thumb,
                };
            });

            const totals = {
                subtotalText: formatCurrency(toNumber(order.subtotal)),
                discount: toNumber(order.discount_total),
                discountText: formatCurrency(toNumber(order.discount_total)),
                shippingText: formatCurrency(toNumber(order.shipping_fee)),
                totalText: formatCurrency(toNumber(order.grand_total)),
            };

            const shippingAddress = [
                order.shipping_line1,
                order.shipping_ward,
                order.shipping_district,
                order.shipping_city,
            ]
                .filter(Boolean)
                .join(", ");

            const shippingRecipient = [
                order.shipping_full_name,
                order.shipping_phone,
            ]
                .filter((part) => part && String(part).trim() !== "")
                .join(" • ");

            const quantityTotal = items.reduce(
                (sum, item) => sum + item.quantity,
                0
            );

            return {
                id: order.id,
                shortCode: `#${order.id.slice(0, 8).toUpperCase()}`,
                statusLabel: statusInfo.label,
                statusClass: statusInfo.className,
                createdAtText: formatDateTime(order.created_at),
                paymentLabel,
                totals,
                hasDiscount: totals.discount > 0,
                shipping: {
                    name: order.shipping_full_name,
                    phone: order.shipping_phone,
                    address: shippingAddress,
                    recipient: shippingRecipient,
                },
                note: order.note ?? null,
                items,
                quantityTotal,
            };
        });

        return res.render("client/pages/user/order", {
            orders: ordersForView,
        });
    } catch (error) {
        console.error("USER ORDER LIST ERROR:", error);
        req.flash("error", "Không thể tải danh sách đơn hàng.");
        return res.redirect(req.get("Referer") || "/user/info");
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
            where: { token_user: req.cookies.token_user },
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
            where: { token_user: req.cookies.token_user },
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
            where: { token_user: req.cookies.token_user },
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

        const tokenUser = req.cookies.token_user;
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

        const tokenUser = req.cookies.token_user;

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
            },
        });

        req.flash("success", "Xóa địa chỉ thành công!");
        return res.redirect(req.get("Referer") || "/user/address");
    } catch (error) {
        console.error("ERROR:", error);
        req.flash("error", "Có lỗi xảy ra!");
        return res.redirect(req.get("Referer") || "/user/address");
    }
};

// [GET] /user/voucher
export const voucher = async (req: Request, res: Response) => {
    try {
        const coupons = await prisma.coupons.findMany({
            where: { status: "ACTIVE", enddate: { gt: new Date() } },
            orderBy: [{ enddate: "asc" }, { createdat: "desc" }],
            select: {
                couponid: true,
                code: true,
                title: true,
                type: true,
                enddate: true,
                usagelimit: true,
                usedcount: true,
                minordervalue: true,
                discountvalue: true,
                maxdiscount: true,
                startdate: true,
            },
        });

        const formatCurrency = (value: unknown) => {
            if (value === undefined || value === null) return null;
            const numberValue =
                typeof value === "number" ? value : Number(value as any);
            if (!Number.isFinite(numberValue)) return null;
            return new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
                maximumFractionDigits: 0,
            }).format(numberValue);
        };

        const formatPercent = (value: unknown) => {
            if (value === undefined || value === null) return null;
            const numberValue =
                typeof value === "number" ? value : Number(value as any);
            if (!Number.isFinite(numberValue)) return null;
            return `${
                numberValue % 1 === 0 ? numberValue : numberValue.toFixed(1)
            }%`;
        };

        const formatDate = (date: Date | null | undefined) => {
            if (!date) return "Không giới hạn";
            return new Intl.DateTimeFormat("vi-VN").format(date);
        };

        const now = new Date();

        const vouchers = coupons.map((coupon) => {
            const remaining =
                typeof coupon.usagelimit === "number"
                    ? Math.max(coupon.usagelimit - coupon.usedcount, 0)
                    : null;
            const isOutOfQuota =
                typeof remaining === "number" ? remaining <= 0 : false;

            const rawTitle = coupon.title?.trim() || "";

            const discountValue =
                coupon.discountvalue !== null &&
                coupon.discountvalue !== undefined
                    ? Number(coupon.discountvalue as any)
                    : null;
            const maxDiscount =
                coupon.maxdiscount !== null && coupon.maxdiscount !== undefined
                    ? Number(coupon.maxdiscount as any)
                    : null;
            const minOrder =
                coupon.minordervalue !== null &&
                coupon.minordervalue !== undefined
                    ? Number(coupon.minordervalue as any)
                    : null;

            let benefit = "";
            switch (coupon.type) {
                case "PERCENT": {
                    const percent = formatPercent(discountValue);
                    benefit = percent
                        ? `Giảm ${percent}`
                        : "Giảm % trên tổng đơn";
                    if (maxDiscount) {
                        benefit += ` (tối đa ${formatCurrency(maxDiscount)})`;
                    }
                    break;
                }
                case "AMOUNT": {
                    const amount = formatCurrency(discountValue);
                    benefit = amount ? `Giảm ${amount}` : "Giảm giá trực tiếp";
                    break;
                }
                case "FREESHIP": {
                    benefit = "Miễn phí vận chuyển";
                    if (maxDiscount) {
                        benefit += ` (tối đa ${formatCurrency(maxDiscount)})`;
                    }
                    break;
                }
                default:
                    benefit = "Ưu đãi đặc biệt";
            }

            const notes: string[] = [];
            if (benefit) notes.push(benefit);
            if (minOrder) {
                notes.push(`Đơn tối thiểu ${formatCurrency(minOrder)}`);
            }
            if (coupon.startdate) {
                notes.push(`Hiệu lực từ ${formatDate(coupon.startdate)}`);
            }

            const normalizedTitle = rawTitle.toLowerCase();
            const normalizedCode = coupon.code?.trim().toLowerCase() ?? "";

            const notesForView = [...notes];
            let description = rawTitle;

            if (
                !description ||
                (normalizedTitle && normalizedTitle === normalizedCode)
            ) {
                description =
                    notesForView.length > 0
                        ? notesForView.shift() || "Ưu đãi hấp dẫn đang chờ bạn"
                        : "Ưu đãi hấp dẫn đang chờ bạn";
            }

            return {
                id: coupon.couponid,
                code: coupon.code,
                description,
                notes: notesForView,
                remaining,
                remainingLabel:
                    typeof remaining === "number"
                        ? remaining > 0
                            ? `Còn ${remaining}`
                            : "Hết lượt"
                        : "Không giới hạn",
                expiryText: formatDate(coupon.enddate),
                isExpired: coupon.enddate ? coupon.enddate < now : false,
                isOutOfQuota,
                termsUrl: "#",
            };
        });
        res.render("client/pages/user/voucher", {
            vouchers,
        });
    } catch (error) {
        req.flash("error", "Vui lòng đăng nhập để xem thông tin.");
        res.redirect("/auth/login");
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
};
