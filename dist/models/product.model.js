"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const VariantSchema = new mongoose_1.default.Schema({
    color: {
        type: String,
        required: true
    },
    images: {
        type: [String],
        required: true
    },
    stock: {
        type: Number,
        required: true,
        default: 0
    }
});
const ProductSchema = new mongoose_1.default.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    discount: {
        type: Number,
        min: 0,
        max: 100
    },
    categoryId: {
        type: String,
        required: true
    },
    size: {
        type: [String],
        enum: ["S", "M", "L", "XL", "XXL"],
        required: true
    },
    thumbnail: {
        type: String,
        required: true
    },
    variants: {
        type: [VariantSchema],
        required: true
    },
    status: {
        type: String,
        enum: ["active", "inactive"],
        default: "active"
    },
    deleted: {
        type: Boolean,
        default: false
    },
}, {
    timestamps: true
});
ProductSchema.index({ title: 'text', description: 'text' });
const Product = mongoose_1.default.model('Product', ProductSchema, 'products');
exports.default = Product;
