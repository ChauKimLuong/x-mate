import { Router } from "express";
import {
  revenueReport,
  exportRevenueExcel,
  inventoryReport,
  exportInventoryExcel,
} from "../../controllers/admin/reports.controller";

const router = Router();

router.get("/revenue", revenueReport);
router.get("/revenue/export", exportRevenueExcel);

router.get("/inventory", inventoryReport);
router.get("/inventory/export", exportInventoryExcel);

export default router;
