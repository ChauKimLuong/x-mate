import { Router } from "express";
import productsRouter from "./products.route";
import inventoryRouter from "./inventory.route";
import inventorySupportRouter from "./inventory-support.route";
const r = Router();

r.get("/", (_req, res) => {
  const period = "week";
  const labels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const series = [1200, 2300, 2300, 3100, 4800, 5200, 3900];

  res.render("admin/pages/dashboard/index", {
    title: "Overview",
    active: "overview",
    period,
    labels,
    series,
    salesToday: 10567,
    growth: 10.57,
    stats: { customers: "345k", revenue: "43,594", orders: "1,208" }
  });
});
r.use("/products", productsRouter);
r.use("/inventory", inventoryRouter);
r.use("/inventory-support", inventorySupportRouter);
export default r;
