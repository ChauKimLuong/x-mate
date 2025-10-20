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
exports.remove = exports.update = exports.editForm = exports.create = exports.createForm = exports.list = void 0;
const client_1 = require("@prisma/client");
const nanoid_1 = require("nanoid");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma = new client_1.PrismaClient();
const list = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    try {
        const filter = req.query.role || "All";
        const allRoles = yield prisma.roles.findMany();
        let where = {};
        if (filter !== "All") {
            const selectedRole = allRoles.find(r => r.name.toLowerCase() === filter.toLowerCase());
            if (selectedRole) {
                where = { role: selectedRole.id };
            }
        }
        const users = yield prisma.users.findMany({
            where,
            include: { roles: true },
            orderBy: { created_at: "desc" },
        });
        const counts = {
            all: yield prisma.users.count(),
            admin: yield prisma.users.count({ where: { role: (_a = allRoles.find(r => r.name === "admin")) === null || _a === void 0 ? void 0 : _a.id } }),
            staff: yield prisma.users.count({ where: { role: (_b = allRoles.find(r => r.name === "staff")) === null || _b === void 0 ? void 0 : _b.id } }),
            customer: yield prisma.users.count({ where: { role: (_c = allRoles.find(r => r.name === "customer")) === null || _c === void 0 ? void 0 : _c.id } }),
        };
        res.render("admin/pages/users/list", {
            title: "Users",
            active: "users",
            users,
            filter,
            counts,
        });
    }
    catch (err) {
        const anyErr = err;
        if ((anyErr === null || anyErr === void 0 ? void 0 : anyErr.code) === 'P2002' && Array.isArray((_d = anyErr === null || anyErr === void 0 ? void 0 : anyErr.meta) === null || _d === void 0 ? void 0 : _d.target) && anyErr.meta.target.includes('email')) {
            (_f = (_e = req).flash) === null || _f === void 0 ? void 0 : _f.call(_e, 'error', 'Email đã tồn tại');
            return res.redirect('/admin/users/create');
        }
        console.error("❌ Error loading users:", err);
        res.status(500).send("Error loading users");
    }
});
exports.list = list;
const createForm = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const roles = yield prisma.roles.findMany();
        res.render("admin/pages/users/form", {
            title: "Add Staff",
            active: "users",
            mode: "create",
            form: {},
            roles,
        });
    }
    catch (err) {
        console.error("❌ Error loading create form:", err);
        res.status(500).send("Error loading form");
    }
});
exports.createForm = createForm;
const create = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let { full_name, email, password, phone, gender, role } = req.body;
        const token_user = `tok_${(0, nanoid_1.nanoid)(10)}`;
        if (gender === "Nam" || gender === "Nữ") {
            gender = gender;
        }
        else {
            gender = null;
        }
        email = String(email || '').toLowerCase();
        password = yield bcrypt_1.default.hash(String(password || ''), 10);
        if (role && typeof role === 'string' && role.indexOf('-') === -1) {
            const r = yield prisma.roles.findFirst({ where: { name: role } });
            if (r)
                role = r.id;
        }
        yield prisma.users.create({
            data: {
                full_name,
                email,
                password,
                phone,
                gender,
                role,
                token_user,
                status: "active",
            },
        });
        res.redirect("/admin/users");
    }
    catch (err) {
        console.error("❌ Error creating user:", err);
        res.status(500).send("Error creating user");
    }
});
exports.create = create;
const editForm = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        const user = yield prisma.users.findUnique({
            where: { id },
            include: { roles: true },
        });
        const roles = yield prisma.roles.findMany();
        if (!user)
            return res.status(404).send("User not found");
        res.render("admin/pages/users/form", {
            title: "Edit User",
            active: "users",
            mode: "edit",
            form: user,
            roles,
        });
    }
    catch (err) {
        console.error("❌ Error loading edit form:", err);
        res.status(500).send("Error loading user form");
    }
});
exports.editForm = editForm;
const update = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { full_name, email, phone, status, role, gender, password } = req.body;
        const id = req.params.id;
        let genderMapped = null;
        if (typeof gender === 'string') {
            const g = gender.trim().toLowerCase();
            if (g === 'nam' || g === 'male')
                genderMapped = 'Nam';
            else if (g === 'nữ' || g === 'nu' || g === 'female')
                genderMapped = 'Nữ';
            else if (g === 'nam' || g === 'nữ')
                genderMapped = gender;
            else
                genderMapped = null;
        }
        const updateData = { full_name, email: email ? String(email).toLowerCase() : undefined, phone, status, role, gender: genderMapped };
        if (password && String(password).trim() !== "") {
            updateData.password = yield bcrypt_1.default.hash(String(password), 10);
        }
        yield prisma.users.update({ where: { id }, data: updateData });
        res.redirect("/admin/users");
    }
    catch (err) {
        console.error("❌ Error updating user:", err);
        res.status(500).send("Error updating user");
    }
});
exports.update = update;
const remove = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        yield prisma.users.update({
            where: { id },
            data: { deleted: true, deleted_at: new Date(), status: "inactive" },
        });
        res.redirect("/admin/users");
    }
    catch (err) {
        console.error("❌ Error deleting user:", err);
        res.status(500).send("Error deleting user");
    }
});
exports.remove = remove;
