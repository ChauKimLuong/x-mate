import { Router } from "express";
import * as ctrl from "../../controllers/admin/users.controller";
const r = Router();

// Danh sách
r.get("/", ctrl.list);

// Form tạo
r.get("/create", ctrl.createForm);

// Tạo (POST /admin/users)
r.post("/", ctrl.create);

// Form sửa
r.get("/:id/edit", ctrl.editForm);

// Cập nhật (POST /admin/users/:id)
r.post("/:id", ctrl.update);

// Xóa mềm
r.get("/:id/delete", ctrl.remove);

export default r;
