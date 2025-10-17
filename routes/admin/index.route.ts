import { Router } from "express";
import productsRouter from "./products.route";
import inventoryRouter from "./inventory.route";
import inventorySupportRouter from "./inventory-support.route";
import reviewsRouter from "./reviews.route";
import ordersRouter from "./orders.route";
import { dashboard } from "../../controllers/admin/dashboard.controller";
import promotionsRouter from "./promotions.route";
import reportsRouter from "./reports.route";
import usersRouter from "./users.route";
import authRouter from "./auth.route";
import categoriesRouter from "./categories.route";
import { requireAdmin } from "../../middlewares/adminAuth";
const r = Router();

r.use("/", authRouter);

// Protect all routes below
r.use(requireAdmin);

// Dashboard routes
r.get("/", (req, res) => res.redirect("/admin/dashboard"));
r.get("/dashboard", dashboard);
r.use("/promotions", promotionsRouter);
r.use("/reports", reportsRouter);
r.use("/users", usersRouter);

r.use("/categories", categoriesRouter);
r.use("/products", productsRouter);
r.use("/inventory", inventoryRouter);
r.use("/inventory-support", inventorySupportRouter);
r.use("/reviews", reviewsRouter);
r.use("/orders", ordersRouter);
export default r;
