"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reports_controller_1 = require("../../controllers/admin/reports.controller");
console.log("🧩 reports.controller exports:", {
    revenueReport: reports_controller_1.revenueReport,
    exportRevenueExcel: reports_controller_1.exportRevenueExcel,
    inventoryReport: reports_controller_1.inventoryReport,
    exportInventoryExcel: reports_controller_1.exportInventoryExcel,
});
const router = (0, express_1.Router)();
router.get("/revenue", reports_controller_1.revenueReport);
router.get("/revenue/export", reports_controller_1.exportRevenueExcel);
router.get("/inventory", reports_controller_1.inventoryReport);
router.get("/inventory/export", reports_controller_1.exportInventoryExcel);
exports.default = router;
