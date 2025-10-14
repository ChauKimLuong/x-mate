// src/routes/admin/products.route.ts
import { Router } from "express";
import multer from "multer";
import {
  getProducts,
  showCreateProduct,
  createProduct,
  showProduct,        // NEW: view
  editProductForm,    // NEW: edit form
  updateProduct,      // NEW: edit submit
  softDeleteProduct,  // NEW: delete (soft)
  toggleStatus,       // NEW: optional: bật/tắt active
} from "../../controllers/admin/products.controller";

const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8*1024*1024, files: 40 } });

/* LIST + CREATE */
r.get("/", getProducts);
r.get("/create", showCreateProduct);
r.post("/", upload.any(), createProduct);

/* VIEW + EDIT + DELETE (soft) */
r.get("/:id", showProduct);
r.get("/:id/edit", editProductForm);
r.post("/:id", upload.any(), updateProduct);        // cập nhật
r.post("/:id/delete", softDeleteProduct);

/* (tuỳ chọn) Toggle status nhanh */
r.post("/:id/toggle-status", toggleStatus);

export default r;
