"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.postLogin = exports.getLogin = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const database_1 = __importDefault(require("../../config/database"));
const getLogin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (req.session && req.session.admin) {
        return res.redirect("/admin/dashboard");
    }
    return res.render("admin/pages/log/login");
});
exports.getLogin = getLogin;
const postLogin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            req.flash("error", "Vui lòng nhập email và mật khẩu");
            return res.redirect("/admin/login");
        }
        const user = yield database_1.default.users.findFirst({
            where: { email },
            include: { roles: true },
        });
        if (!user) {
            req.flash("error", "Tài khoản không tồn tại");
            return res.redirect("/admin/login");
        }
        const ok = yield bcrypt_1.default.compare(password, user.password);
        if (!ok) {
            req.flash("error", "Mật khẩu không chính xác");
            return res.redirect("/admin/login");
        }
        const roleName = (_b = (_a = user.roles) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.toLowerCase();
        const allowed = roleName === "admin" || roleName === "staff";
        if (!allowed) {
            req.flash("error", "Bạn không có quyền truy cập trang quản trị");
            return res.redirect("/admin/login");
        }
        req.session.admin = {
            id: user.id,
            email: user.email,
            role: roleName,
        };
        return req.session.save(() => res.redirect("/admin/dashboard"));
    }
    catch (err) {
        console.error("Admin login error:", err);
        req.flash("error", "Đăng nhập thất bại, vui lòng thử lại");
        return res.redirect("/admin/login");
    }
});
exports.postLogin = postLogin;
const logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        req.session.destroy(() => {
            res.redirect("/admin/login");
        });
    }
    catch (_a) {
        return res.redirect("/admin/login");
    }
});
exports.logout = logout;
