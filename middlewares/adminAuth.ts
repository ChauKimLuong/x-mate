import { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const admin = (req.session as any)?.admin;
  if (admin) {
    // Expose to views
    (res.locals as any).admin = admin;
    return next();
  }
  return res.redirect("/admin/login");
}

export function redirectIfAuthed(req: Request, res: Response, next: NextFunction) {
  const admin = (req.session as any)?.admin;
  if (admin) {
    (res.locals as any).admin = admin;
    return res.redirect("/admin/dashboard");
  }
  return next();
}
