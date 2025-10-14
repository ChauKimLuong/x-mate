import express from "express";
import * as userController from "../../controllers/client/user.controller";

const router = express.Router();

router.get("/info", userController.info);
router.post("/update-info", userController.updateInfo)
router.post("/change-password", userController.changePassword)
router.get("/address", userController.address);
router.post("/address", userController.addressPost)
router.post("/address/update", userController.addressUpdate)
router.post("/address/default/:addressId", userController.addressDefault)
router.post("/address/delete/:addressId", userController.addressDelete)
router.get("/voucher", userController.voucher);
router.get("/order", userController.order);

export default router;
