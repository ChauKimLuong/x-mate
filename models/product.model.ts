import mongoose from "mongoose";

export interface IVariant {
    color: string;
    images: string[];
    stock: number;
}

export interface IProduct extends Document {
    title: string;
    description: string;
    price: number;
    discount?: number;
    categoryId: string;
    size: string[];
    thumbnail: string;
    variants: IVariant[];
    status: 'active' | 'inactive';
    deleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const VariantSchema = new mongoose.Schema<IVariant>({
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
})

const ProductSchema = new mongoose.Schema<IProduct>({
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
})

ProductSchema.index({ title: 'text', description: 'text' });

const Product = mongoose.model<IProduct>('Product', ProductSchema, 'products');

export default Product;
