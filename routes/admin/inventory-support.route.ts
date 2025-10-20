import { Router } from "express";
import multer from "multer";
import * as c from "../../controllers/admin/inventorySupport.controller";

const r = Router();
const upload = multer(); // memoryStorage mặc định

// Page
r.get("/", c.page);

// Low-stock API
r.get("/low-stock", c.lowStock);
// Lookup products (for Quick Count helper)
r.get("/lookup", c.lookup);

// Reorder draft CSV
r.post("/reorder-draft", c.reorderDraftCsv);

// Stocktake
r.post("/stocktake", c.createStocktake);
r.get("/stocktake/:sid", c.viewStocktake);
r.get("/stocktake/:sid/json", c.stocktakeJson);
r.get("/stocktake/:sid/download", c.downloadStocktake);
r.post("/stocktake/:sid/upload", upload.single("file"), c.uploadStocktakeCsv);
r.post("/stocktake/:sid/post", c.postStocktake);
r.post("/stocktake/:sid/delete", c.deleteStocktake);

// Quick Count (đếm nhanh 1 sản phẩm — không CSV)
r.post("/quick-count", c.quickCount);

// Bulk adjust
r.post("/bulk-adjust/upload", upload.single("file"), c.bulkUpload);
r.post("/bulk-adjust/commit", c.bulkCommit);

// Barcode / QR
r.get("/barcode", c.barcode);          // trang preview
r.get("/barcode.svg", c.barcodeImage); // ảnh SVG thực tế

// Export & Template
r.get("/export", c.exportCsv);
r.get("/template.csv", c.templateCsv);

// Diagnostics & Rebuild
r.get("/diagnostics", c.diagnostics);
r.get("/history", c.historyJson);
r.get("/rebuild-onhand", c.rebuildOnHand);

export default r;
