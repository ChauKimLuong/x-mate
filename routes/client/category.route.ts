import express, { Response, Request } from "express";

const router = express.Router();
const categoryController = require("../../controllers/client/category.controller");

router.get("/", categoryController.index);

export default router;