import { Request, Response, NextFunction } from "express";

export function onlyAdmin(req: Request, res: Response, next: NextFunction) {
  const role = (req.session as any)?.admin?.role;
  if (role === "admin") return next();
  if (req.method === "GET") return res.redirect("/admin/orders");
  return res.status(403).send("Forbidden");
}

