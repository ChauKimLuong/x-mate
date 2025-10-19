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
exports.registerPost = exports.register = exports.loginPost = exports.login = void 0;
const database_1 = __importDefault(require("../../config/database"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.render("client/pages/user/login");
});
exports.login = login;
const loginPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { phoneOrEmail, password } = req.body;
    console.log(req.body);
    try {
        if (!phoneOrEmail || !password) {
            req.flash("error", "Vui lòng nhập đầy đủ thông tin đăng nhập!");
            return res.redirect("/auth/login");
        }
        const user = yield database_1.default.users.findFirst({
            where: {
                OR: [
                    { email: phoneOrEmail },
                    { phone: phoneOrEmail },
                ],
            },
        });
        if (!user) {
            req.flash("error", "Email/SĐT không tồn tại!");
            return res.redirect("/auth/login");
        }
        const isMatch = yield bcrypt_1.default.compare(password, user.password);
        if (!isMatch) {
            req.flash("error", "Mật khẩu không chính xác!");
            return res.redirect("/auth/login");
        }
        req.flash("success", "Đăng nhập thành công!");
        return res.redirect("/");
    }
    catch (error) {
        console.error("ERROR:", error);
        req.flash("error", "Đăng nhập thất bại, vui lòng thử lại sau!");
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
                OR: [
                    { email: email },
                    { phone: phone },
                ],
            },
        });
        if (existedUser) {
            req.flash("error", "Email hoặc số điện thoại đã tồn tại!");
            return res.redirect("/auth/register");
        }
        const hashedPassword = yield bcrypt_1.default.hash(password, 10);
        yield database_1.default.users.create({
            data: {
                full_name: fullName,
                phone: phone,
                email: email,
                password: hashedPassword,
                token_user: `tok_${Math.random().toString(36).slice(2, 14)}`,
            },
        });
        req.flash("success", "Đăng ký thành công! Đăng nhập để tiếp tục.");
        return res.redirect("/auth/login");
    }
    catch (error) {
        console.error("ERROR:", error);
        req.flash("error", "Đăng ký thất bại, vui lòng thử lại sau!");
        return res.redirect("/auth/register");
    }
});
exports.registerPost = registerPost;
