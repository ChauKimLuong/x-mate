"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventory_controller_1 = require("../../controllers/admin/inventory.controller");
const r = (0, express_1.Router)();
r.get("/", inventory_controller_1.getInventory);
exports.default = r;
