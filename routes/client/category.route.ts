import express, { Response, Request } from "express";
import * as categoryController from "../../controllers/client/category.controller";
const router = express.Router();

// router.get("/", categoryController.index);
router.get("/:slug", categoryController.detail);

export default router;