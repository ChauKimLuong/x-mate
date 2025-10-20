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
exports.navCategoriesMiddleware = void 0;
const database_1 = __importDefault(require("../../config/database"));
const category_nav_1 = require("../../utils/category-nav");
const CACHE_TTL = 5 * 60 * 1000;
let cachedNav = {
    data: [],
    expires: 0,
};
const navCategoriesMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (Array.isArray(res.locals.primaryCategories) && res.locals.primaryCategories.length) {
        return next();
    }
    const now = Date.now();
    if (cachedNav.data.length && now < cachedNav.expires) {
        res.locals.primaryCategories = cachedNav.data;
        return next();
    }
    try {
        const categories = yield database_1.default.categories.findMany({
            where: { status: { equals: "active" } },
            select: {
                id: true,
                title: true,
                slug: true,
                parentId: true,
            },
        });
        const nav = (0, category_nav_1.buildPrimaryNav)(categories);
        cachedNav = {
            data: nav,
            expires: now + CACHE_TTL,
        };
        res.locals.primaryCategories = nav;
    }
    catch (error) {
        console.error("NAV CATEGORIES ERROR:", error);
        res.locals.primaryCategories = cachedNav.data || [];
    }
    next();
});
exports.navCategoriesMiddleware = navCategoriesMiddleware;
exports.default = exports.navCategoriesMiddleware;
