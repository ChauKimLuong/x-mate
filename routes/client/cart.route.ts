import express from "express";
import * as cartController from "../../controllers/client/cart.controller";

const router = express.Router();

router.get("/", cartController.index);
router.post("/items", cartController.addItem);
router.post("/items/:id/quantity", cartController.updateItemQuantity);
router.post("/items/:id/delete", cartController.removeItem);
router.post("/items/batch-delete", cartController.removeSelectedItems);
router.post("/coupon", cartController.applyCoupon);
router.post("/prepare-checkout", cartController.prepareCheckout);
router.post("/clear", cartController.clearCart);

export default router;
