"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const categories_controller_1 = require("../../controllers/admin/categories.controller");
const r = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 20 } });
r.get("/", categories_controller_1.getCategories);
r.get("/create", categories_controller_1.showCreateCategory);
r.post("/", upload.any(), categories_controller_1.createCategory);
r.get("/:id/edit", categories_controller_1.editCategoryForm);
r.post("/:id", upload.any(), categories_controller_1.updateCategory);
r.post("/:id/delete", categories_controller_1.softDeleteCategory);
r.post("/:id/toggle-status", categories_controller_1.toggleStatus);
exports.default = r;
