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
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = exports.update = exports.editForm = exports.create = exports.createForm = exports.list = void 0;
const client_1 = require("@prisma/client");
const nanoid_1 = require("nanoid");
const prisma = new client_1.PrismaClient();
const list = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
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
        const { full_name, email, phone, status, role, gender } = req.body;
        const id = req.params.id;
        yield prisma.users.update({
            where: { id },
            data: { full_name, email, phone, status, role, gender },
        });
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
