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
exports.makeSlug = void 0;
exports.makeUniqueCategorySlug = makeUniqueCategorySlug;
exports.makeUniqueProductSlug = makeUniqueProductSlug;
const slugify_1 = __importDefault(require("slugify"));
const database_1 = __importDefault(require("../config/database"));
const makeSlug = (s) => (0, slugify_1.default)(s, { lower: true, strict: true, locale: "vi", trim: true });
exports.makeSlug = makeSlug;
function makeUniqueCategorySlug(title, currentId) {
    return __awaiter(this, void 0, void 0, function* () {
        const base = (0, exports.makeSlug)(title);
        let candidate = base;
        let i = 2;
        while (true) {
            const exists = yield database_1.default.categories.findFirst({
                where: Object.assign({ slug: candidate }, (currentId ? { NOT: { id: currentId } } : {})),
                select: { id: true },
            });
            if (!exists)
                return candidate;
            candidate = `${base}-${i++}`;
        }
    });
}
function makeUniqueProductSlug(title, currentId) {
    return __awaiter(this, void 0, void 0, function* () {
        const base = (0, exports.makeSlug)(title);
        let candidate = base;
        let i = 2;
        while (true) {
            const exists = yield database_1.default.products.findFirst({
                where: Object.assign({ slug: candidate }, (currentId ? { NOT: { id: currentId } } : {})),
                select: { id: true },
            });
            if (!exists)
                return candidate;
            candidate = `${base}-${i++}`;
        }
    });
}
