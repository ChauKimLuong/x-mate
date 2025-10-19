"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reviews_controller_1 = require("../../controllers/admin/reviews.controller");
const r = (0, express_1.Router)();
r.get("/", reviews_controller_1.ReviewsController.list);
r.get("/:id/detail", reviews_controller_1.ReviewsController.detail);
r.post("/reply", reviews_controller_1.ReviewsController.reply);
exports.default = r;
