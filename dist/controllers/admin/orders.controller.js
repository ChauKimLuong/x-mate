"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersController = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class OrdersController {
    static list(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const orders = yield prisma.orders.findMany({
                    orderBy: { created_at: "desc" },
                    include: {
                        order_items: {
                            take: 1,
                            include: {
                                products: {
                                    select: { thumbnail: true },
                                },
                            },
                        },
                    },
                });
                const viewOrders = orders.map((o) => {
                    var _a, _b, _c;
                    return ({
                        id: o.id,
                        customerName: o.shipping_full_name,
                        total: Number(o.grand_total || 0),
                        status: o.status,
                        thumbnail: ((_c = (_b = (_a = o.order_items) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.products) === null || _c === void 0 ? void 0 : _c.thumbnail) || null
                    });
                });
                res.render("admin/pages/orders/list", { orders: viewOrders });
            }
            catch (error) {
                console.error("Lỗi khi tải danh sách đơn hàng:", error);
                res.status(500).send("Không thể tải danh sách đơn hàng");
            }
        });
    }
    static detail(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            try {
                const order = yield prisma.orders.findUnique({
                    where: { id },
                    include: {
                        order_items: {
                            include: { products: true, productVariants: true },
                        },
                    },
                });
                if (!order)
                    return res.status(404).send("Không tìm thấy đơn hàng");
                res.render("admin/pages/orders/detail", { order });
            }
            catch (error) {
                console.error("Lỗi khi xem chi tiết đơn hàng:", error);
                res.status(500).send("Không thể tải chi tiết đơn hàng");
            }
        });
    }
    static confirm(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            try {
                const order = yield prisma.orders.findUnique({ where: { id } });
                if (!order)
                    return res.status(404).send("Không tìm thấy đơn hàng");
                if (order.status !== "pending") {
                    return res.status(400).send("Đơn hàng không ở trạng thái chờ xác nhận");
                }
                yield prisma.orders.update({
                    where: { id },
                    data: { status: "completed", updated_at: new Date() },
                });
                const items = yield prisma.order_items.findMany({ where: { order_id: id } });
                for (const item of items) {
                    yield prisma.inventoryMovements.create({
                        data: {
                            productId: item.product_id,
                            variantId: item.variant_id,
                            delta: -item.quantity,
                            reason: "orderPlaced",
                            refOrderId: id,
                        },
                    });
                }
                res.redirect("/admin/orders");
            }
            catch (error) {
                console.error("Lỗi khi xác nhận đơn hàng:", error);
                res.status(500).send("Không thể xác nhận đơn hàng");
            }
        });
    }
    static cancel(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            try {
                const order = yield prisma.orders.findUnique({ where: { id } });
                if (!order)
                    return res.status(404).send("Không tìm thấy đơn hàng");
                if (order.status !== "pending") {
                    return res.status(400).send("Chỉ có thể hủy đơn hàng đang chờ xác nhận");
                }
                yield prisma.orders.update({
                    where: { id },
                    data: { status: "cancelled", updated_at: new Date() },
                });
                res.redirect("/admin/orders");
            }
            catch (error) {
                console.error("Lỗi khi hủy đơn hàng:", error);
                res.status(500).send("Không thể hủy đơn hàng");
            }
        });
    }
}
exports.OrdersController = OrdersController;
