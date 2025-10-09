// routes/admin/inventory-support.route.ts
import { Router } from "express";
import * as ctl from "../../controllers/admin/inventorySupport.controller";
const r = Router();

r.get("/", ctl.page);                         // render helper.pug
r.get("/low-stock", ctl.lowStock);
r.post("/reorder-draft", ctl.reorderDraftCsv);

r.post("/stocktake", ctl.createStocktake);
r.get("/stocktake/:sid", ctl.viewStocktake);
r.get("/stocktake/:sid/download", ctl.downloadStocktake);
r.post("/stocktake/:sid/upload-csv", ctl.uploadStocktakeCsv);
r.post("/stocktake/:sid/post", ctl.postStocktake);

r.post("/bulk-adjust/upload", ctl.bulkUpload);
r.post("/bulk-adjust/commit", ctl.bulkCommit);

r.get("/barcode", ctl.barcode);
r.get("/export", ctl.exportCsv);
r.get("/template.csv", ctl.templateCsv);

r.get("/diagnostics", ctl.diagnostics);
r.post("/rebuild-onhand", ctl.rebuildOnHand);

export default r;
