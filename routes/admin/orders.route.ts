import { Router } from "express";
import { OrdersController } from "../../controllers/admin/orders.controller";

const r = Router();

// Danh sách đơn hàng
r.get("/", OrdersController.list);

// Chi tiết đơn hàng
r.get("/:id/detail", OrdersController.detail);

// Xác nhận đơn
r.post("/:id/confirm", OrdersController.confirm);

// Hủy đơn
r.post("/:id/cancel", OrdersController.cancel);

export default r;
