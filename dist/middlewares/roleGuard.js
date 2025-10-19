"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onlyAdmin = onlyAdmin;
function onlyAdmin(req, res, next) {
    var _a, _b;
    const role = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.admin) === null || _b === void 0 ? void 0 : _b.role;
    if (role === "admin")
        return next();
    if (req.method === "GET")
        return res.redirect("/admin/orders");
    return res.status(403).send("Forbidden");
}
