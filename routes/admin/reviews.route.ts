import { Router } from "express";
import { ReviewsController } from "../../controllers/admin/reviews.controller";

const r = Router();

r.get("/", ReviewsController.list);
r.get("/:id/detail", ReviewsController.detail);
r.post("/reply", ReviewsController.reply);

export default r;
