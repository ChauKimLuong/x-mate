"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = requireAdmin;
exports.redirectIfAuthed = redirectIfAuthed;
function requireAdmin(req, res, next) {
    var _a;
    const admin = (_a = req.session) === null || _a === void 0 ? void 0 : _a.admin;
    if (admin) {
        res.locals.admin = admin;
        return next();
    }
    return res.redirect("/admin/login");
}
function redirectIfAuthed(req, res, next) {
    var _a;
    const admin = (_a = req.session) === null || _a === void 0 ? void 0 : _a.admin;
    if (admin) {
        res.locals.admin = admin;
        return res.redirect("/admin/dashboard");
    }
    return next();
}
