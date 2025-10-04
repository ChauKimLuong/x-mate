import express, { Response, Request } from "express";
import * as homeController from "../../controllers/client/home.controller";

const router = express.Router();

router.get("/", homeController.index);

export default router;