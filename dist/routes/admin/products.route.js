"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const products_controller_1 = require("../../controllers/admin/products.controller");
const r = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 40 } });
r.get("/", products_controller_1.getProducts);
r.get("/create", products_controller_1.showCreateProduct);
r.post("/", upload.any(), products_controller_1.createProduct);
r.get("/:id", products_controller_1.showProduct);
r.get("/:id/edit", products_controller_1.editProductForm);
r.post("/:id", upload.any(), products_controller_1.updateProduct);
r.post("/:id/delete", products_controller_1.softDeleteProduct);
r.post("/:id/toggle-status", products_controller_1.toggleStatus);
exports.default = r;
