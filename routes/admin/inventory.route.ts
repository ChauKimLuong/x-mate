import { Router } from "express";
import { getInventory } from "../../controllers/admin/inventory.controller";

const r = Router();
r.get("/", getInventory);

export default r;
