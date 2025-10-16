import { Router } from "express";
import { getLogin, postLogin, logout } from "../../controllers/admin/auth.controller";
import { redirectIfAuthed } from "../../middlewares/adminAuth";

const r = Router();

r.get("/login", redirectIfAuthed, getLogin);
r.post("/login", postLogin);
r.post("/logout", logout);

export default r;

