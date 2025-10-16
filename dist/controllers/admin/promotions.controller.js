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
exports.remove = exports.update = exports.create = exports.editForm = exports.createForm = exports.list = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function formatDiscount(type, value) {
    const num = Number(value || 0);
    if (type === "PERCENT")
        return `${num}%`;
    if (type === "AMOUNT")
        return num.toLocaleString("vi-VN") + " đ";
    if (type === "FREESHIP")
        return "Free Ship";
    return "-";
}
const list = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const coupons = yield prisma.coupons.findMany({
            orderBy: { createdat: "desc" },
        });
        const formatted = coupons.map(c => (Object.assign(Object.assign({}, c), { discountText: formatDiscount(c.type, Number(c.discountvalue)) })));
        res.render("admin/pages/promotions/list", {
            title: "Promotions",
            active: "promotions",
            coupons: formatted,
        });
    }
    catch (err) {
        console.error("❌ Error loading promotions:", err);
        res.status(500).send("Error loading promotions");
    }
});
exports.list = list;
const createForm = (_req, res) => {
    res.render("admin/pages/promotions/form", {
        title: "Add Promotion",
        active: "promotions",
        mode: "create",
        form: {
            code: "",
            title: "",
            type: "PERCENT",
            discountvalue: 0,
            startdate: "",
            enddate: "",
            status: "ACTIVE",
        },
    });
};
exports.createForm = createForm;
const editForm = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = Number(req.params.id);
        const promo = yield prisma.coupons.findUnique({
            where: { couponid: id },
        });
        if (!promo) {
            return res.status(404).send("Promotion not found");
        }
        res.render("admin/pages/promotions/form", {
            title: "Edit Promotion",
            active: "promotions",
            mode: "edit",
            form: promo,
        });
    }
    catch (err) {
        console.error("❌ Error loading promotion:", err);
        res.status(500).send("Error loading promotion");
    }
});
exports.editForm = editForm;
const create = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { code, title, type, discount, start, end, status, usagelimit, minordervalue, maxdiscount } = req.body;
        const nDiscount = parseFloat(discount) || 0;
        const nUsageLimit = usagelimit === '' ? null : Number.parseInt(usagelimit, 10);
        const nMinOrderValue = minordervalue === '' ? null : parseFloat(minordervalue);
        const nMaxDiscount = maxdiscount === '' ? null : parseFloat(maxdiscount);
        if (type === 'PERCENT' && (nDiscount < 0 || nDiscount > 100)) {
            return res.status(400).send('Percent must be between 0 and 100');
        }
        if (type === 'AMOUNT' && nDiscount < 0) {
            return res.status(400).send('Fixed amount must be >= 0');
        }
        if (nUsageLimit !== null && nUsageLimit < 0) {
            return res.status(400).send('Usage limit must be >= 0');
        }
        if (nMinOrderValue !== null && nMinOrderValue < 0) {
            return res.status(400).send('Min order value must be >= 0');
        }
        if (nMaxDiscount !== null && nMaxDiscount < 0) {
            return res.status(400).send('Max discount must be >= 0');
        }
        yield prisma.coupons.create({
            data: {
                code,
                title,
                type,
                discountvalue: type === 'FREESHIP' ? 0 : nDiscount,
                startdate: start ? new Date(start) : null,
                enddate: end ? new Date(end) : null,
                status: status || 'INACTIVE',
                usagelimit: nUsageLimit,
                minordervalue: nMinOrderValue,
                maxdiscount: nMaxDiscount,
            },
        });
        res.redirect('/admin/promotions');
    }
    catch (err) {
        console.error('❌ Error creating promotion:', err);
        res.status(500).send('Error creating promotion');
    }
});
exports.create = create;
const update = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = Number(req.params.id);
        const { code, title, type, discount, start, end, status, usagelimit, minordervalue, maxdiscount } = req.body;
        const nDiscount = parseFloat(discount) || 0;
        const nUsageLimit = usagelimit === '' ? null : Number.parseInt(usagelimit, 10);
        const nMinOrderValue = minordervalue === '' ? null : parseFloat(minordervalue);
        const nMaxDiscount = maxdiscount === '' ? null : parseFloat(maxdiscount);
        yield prisma.coupons.update({
            where: { couponid: id },
            data: {
                code,
                title,
                type,
                discountvalue: type === 'FREESHIP' ? 0 : nDiscount,
                startdate: start ? new Date(start) : null,
                enddate: end ? new Date(end) : null,
                status: status || 'INACTIVE',
                usagelimit: nUsageLimit,
                minordervalue: nMinOrderValue,
                maxdiscount: nMaxDiscount,
                updatedat: new Date(),
            },
        });
        res.redirect('/admin/promotions');
    }
    catch (err) {
        console.error('❌ Error updating promotion:', err);
        res.status(500).send('Error updating promotion');
    }
});
exports.update = update;
const remove = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = Number(req.params.id);
        yield prisma.coupons.delete({
            where: { couponid: id },
        });
        res.redirect("/admin/promotions");
    }
    catch (err) {
        console.error("❌ Error deleting promotion:", err);
        res.status(500).send("Error deleting promotion");
    }
});
exports.remove = remove;
