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
exports.logout = exports.registerPost = exports.register = exports.loginPost = exports.login = void 0;
const database_1 = __importDefault(require("../../config/database"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const CART_COOKIE_NAME = "cart_id";
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.render("client/pages/user/login");
});
exports.login = login;
const loginPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { identifier, password } = req.body;
    console.log(req.body);
    try {
        if (!identifier || !password) {
            req.flash("error", "Vui lòng nhập đầy đủ thông tin đăng nhập!");
            return res.redirect("/auth/login");
        }
        const user = yield database_1.default.users.findFirst({
            where: {
                OR: [{ email: identifier }, { phone: identifier }],
            },
        });
        if (!user) {
            req.flash("error", "Email/SDT không tồn tại!");
            return res.redirect("/auth/login");
        }
        const isMatch = yield bcrypt_1.default.compare(password, user.password);
        if (!isMatch) {
            req.flash("error", "Mật khẩu không chính xác!");
            return res.redirect("/auth/login");
        }
        const tokenUser = user.token_user;
        res.cookie("token_user", tokenUser);
        req.flash("success", "Đăng nhập thành công!");
        return res.redirect("/");
    }
    catch (error) {
        console.error("ERROR:", error);
        req.flash("error", "Đăng nhập thất bại!");
        return res.redirect("/auth/login");
    }
});
exports.loginPost = loginPost;
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.render("client/pages/user/register");
});
exports.register = register;
const registerPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { fullName, phone, email, password } = req.body;
        if (!fullName || !phone || !email || !password) {
            req.flash("error", "Vui lòng nhập đầy đủ thông tin!");
            return res.redirect("/auth/register");
        }
        const existedUser = yield database_1.default.users.findFirst({
            where: {
                OR: [{ email: email }, { phone: phone }],
            },
        });
        if (existedUser) {
            req.flash("error", "Email hoặc SĐT đã tồn tại!");
            return res.redirect("/auth/register");
        }
        const hashedPassword = yield bcrypt_1.default.hash(password, 10);
        const tokenUser = `tok_${Math.random().toString(36).slice(2, 14)}`;
        yield database_1.default.users.create({
            data: {
                full_name: fullName,
                phone: phone,
                email: email,
                password: hashedPassword,
                token_user: tokenUser,
            },
        });
        res.cookie("token_user", tokenUser);
        req.flash("success", "Đăng kí thành công!");
        return res.redirect("/");
    }
    catch (error) {
        console.error("ERROR:", error);
        req.flash("error", "Đăng kí thất bại, vui lòng thử lại sau!");
        return res.redirect("/auth/register");
    }
});
exports.registerPost = registerPost;
const logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.cookies || !req.cookies.token_user) {
            req.flash("error", "Bạn chưa đăng nhập!");
            return res.redirect("/auth/login");
        }
        res.clearCookie("token_user");
        res.clearCookie(CART_COOKIE_NAME);
        if (req.session) {
            delete req.session.cart;
            delete req.session.cartCoupon;
        }
        req.flash("success", "Đăng xuất thành công!");
        return res.redirect("/auth/login");
    }
    catch (error) {
        console.error("ERROR:", error);
        req.flash("error", "Đăng xuất thất bại, vui lòng thử lại!");
        return res.redirect(req.get("Referer") || "/");
    }
});
exports.logout = logout;
