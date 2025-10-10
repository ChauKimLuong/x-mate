import { Router } from "express";
import { getReviewsList } from "../../controllers/admin/reviews.controller";

const router = Router();

router.get("/", getReviewsList);

export default router;
