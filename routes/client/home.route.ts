import express, { Response, Request } from "express";

const router = express.Router();
const homeController = require("../../controllers/client/home.controller");

router.get("/", homeController.index);

export default router;