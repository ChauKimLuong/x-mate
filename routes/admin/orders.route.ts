import { Router } from "express";
import { OrdersController } from "../../controllers/admin/orders.controller";

const r = Router();

// Trang danh sách đơn hàng
r.get("/", OrdersController.list);

// Trang chi tiết đơn hàng
r.get("/:id/detail", OrdersController.detail);

// Trang yêu cầu hủy đơn
r.get("/:id/request", OrdersController.request);

export default r;
