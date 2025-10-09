import { Router } from "express";
import { getProducts } from "../../controllers/admin/products.controller";

const r = Router();

r.get("/", getProducts);
// sau này bổ sung: r.get("/new"), r.post("/"), r.get("/:id"), r.post("/:id"), ...

export default r;
