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
import { onlyAdmin } from "../../middlewares/roleGuard";
const r = Router();

r.use("/", authRouter);

// Protect all routes below
r.use(requireAdmin);

// Dashboard routes
// Default landing: staff -> orders, admin -> dashboard
r.get("/", (req, res) => {
  const role = (req.session as any)?.admin?.role;
  if (role === "staff") return res.redirect("/admin/orders");
  return res.redirect("/admin/dashboard");
});

// Admin-only sections
r.get("/dashboard", onlyAdmin, dashboard);
r.use("/promotions", onlyAdmin, promotionsRouter);
r.use("/reports", onlyAdmin, reportsRouter);
r.use("/users", onlyAdmin, usersRouter);
r.use("/categories", onlyAdmin, categoriesRouter);
r.use("/products", onlyAdmin, productsRouter);
// Inventory Support: allow staff access
r.use("/inventory-support", inventorySupportRouter);

// Staff-allowed sections
r.use("/inventory", inventoryRouter);
r.use("/reviews", reviewsRouter);
r.use("/orders", ordersRouter);
export default r;
