import { Router } from "express";
import { list, createForm, editForm, create, update, remove } from "../../controllers/admin/promotions.controller";

const r = Router();

r.get("/", list);
r.get("/create", createForm);
r.post("/", create);
r.get("/:id/edit", editForm);
r.post("/:id", update);
r.get("/:id/delete", remove);

export default r;
