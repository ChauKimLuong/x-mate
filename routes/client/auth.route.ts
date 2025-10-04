import express from "express";
import * as authController from "../../controllers/client/auth.controller";

const router = express.Router();

router.get("/login", authController.login);
router.post("/login", authController.loginPost);

router.get("/register", authController.register);
router.post("/register", authController.registerPost);

export default router;