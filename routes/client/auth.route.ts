import express from "express";
import * as authController from "../../controllers/client/auth.controller";

const router = express.Router();

router.get("/login", authController.login);
router.get("/register", authController.register);

export default router;