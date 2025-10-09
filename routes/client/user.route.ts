import express from "express";
import * as userController from "../../controllers/client/user.controller";

const router = express.Router();

router.get("/info", userController.info);
router.get("/address", userController.address);

export default router;