import express from "express";
import * as userController from "../../controllers/client/user.controller";

const router = express.Router();

router.get("/info", userController.info);
router.post("/update-info", userController.updateInfo)
router.post("/change-password", userController.changePassword)
router.get("/address", userController.address);

export default router;