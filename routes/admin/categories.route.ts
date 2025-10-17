// routes/admin/categories.route.ts
import { Router } from "express";
import multer from "multer";
import {
  getCategories,
  showCreateCategory,
  createCategory,
  editCategoryForm,
  updateCategory,
  softDeleteCategory,
  toggleStatus,
} from "../../controllers/admin/categories.controller";

const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8*1024*1024, files: 20 } });

r.get("/", getCategories);
r.get("/create", showCreateCategory);
r.post("/", upload.any(), createCategory);

r.get("/:id/edit", editCategoryForm);
r.post("/:id", upload.any(), updateCategory);
r.post("/:id/delete", softDeleteCategory);
r.post("/:id/toggle-status", toggleStatus);

export default r;
