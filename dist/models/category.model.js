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
exports.Category = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const slugify_1 = __importDefault(require("slugify"));
const CategorySchema = new mongoose_1.default.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    parentId: {
        type: String,
        default: null,
    },
    description: {
        type: String,
        trim: true,
    },
    thumbnail: {
        type: String,
        trim: true,
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active',
    },
    isFeatured: {
        type: Boolean,
        default: false,
    },
    slug: {
        type: String,
        required: true,
        unique: true,
    },
    position: {
        type: Number,
        default: 0,
    },
    deletedAt: {
        type: Date,
        default: null,
    },
    deleted: {
        type: Boolean,
        default: false,
    }
}, { timestamps: true });
CategorySchema.index({ parentId: 1, title: 1 }, {
    unique: true,
    collation: { locale: "en", strength: 2 },
    partialFilterExpression: { deleted: false }
});
const makeSlug = (title) => {
    return (0, slugify_1.default)(title, { lower: true, strict: true });
};
CategorySchema.pre("validate", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.slug == null || this.slug.trim() == "") {
            const base = makeSlug(this.title);
            let candidate = base;
            let i = 2;
            const Category = mongoose_1.default.model("Category");
            while (yield Category.exists({ slug: candidate, _id: { $ne: this._id } })) {
                candidate = `${base}-${i}`;
                i++;
            }
            this.slug = candidate;
        }
        next();
    });
});
exports.Category = mongoose_1.default.model("Category", CategorySchema, "categories");
