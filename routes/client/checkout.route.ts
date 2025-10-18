import express from "express";
import * as checkoutController from "../../controllers/client/checkout.controller";

const router = express.Router();

router.get("/", checkoutController.index)
router.post("/", checkoutController.checkoutPost);

export default router;
 