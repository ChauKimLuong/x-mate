import express from "express";
import * as cartController from "../../controllers/client/cart.controller";

const router = express.Router();

router.get("/", cartController.index);
router.post("/items", cartController.addItem);

export default router;
