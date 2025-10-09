import { Request, Response } from "express";

export const dashboard = (req: Request, res: Response) => {
  const period = (req.query.period as string) || "ALL";

  const labels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const bar =   [30, 63, 45, 66, 48, 40, 42, 75, 51, 60, 62, 65];   // Page Views (cam)
  const line =  [7,  10, 8,  15, 22, 12, 9,  8,  6,  28, 16, 30];   // Clicks (xanh)

  res.render("admin/pages/dashboard/index", {
    title: "Dashboard",
    active: "overview",
    period,
    labels,
    seriesBar: bar,
    seriesLine: line,
    kpis: {
      totalOrders: 13647,
      newLeads:    9526,
      deals:       976,
      bookedRev:   123600
    },
    deltas: {
      totalOrders: +2.3,     // %
      newLeads:    +8.1,
      deals:       -0.3,
      bookedRev:   -10.6
    }
  });
};
