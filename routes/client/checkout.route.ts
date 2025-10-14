import express from "express";
import * as checkoutController from "../../controllers/client/checkout.controller";

const router = express.Router();

router.get("/", checkoutController.index);

export default router;

