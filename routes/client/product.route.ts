import express from "express";
import * as productController from "../../controllers/client/product.controller";

const router = express.Router();

router.get("/detail/:slug", productController.detail);

export default router;