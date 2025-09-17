import mongoose from "mongoose";
import { title } from "process";
import slugify from "slugify";


export interface ICategory extends Document {
    title: string,
    parentId?: string,
    description?: string,
    thumbnail?: string,
    status: 'active' | 'inactive',
    isFeatured: boolean,
    slug: string,
    position: number,
    deleted: boolean,
    deletedAt?: Date | null,
    createdAt?: Date,
    updatedAt?: Date,
}

const CategorySchema = new mongoose.Schema<ICategory>({
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

CategorySchema.index(
    { parentId: 1, title: 1}, {
        unique: true,
        collation: { locale: "en", strength: 2 },
        partialFilterExpression: { deleted: false }
    }
)

const makeSlug = (title: string) => {
    return slugify(title, { lower: true, strict: true });
}

CategorySchema.pre("validate", async function (next){
    if (this.slug == null || this.slug.trim() == "") {
        const base = makeSlug(this.title);
        let candidate = base;
        let i = 2;

        const Category = mongoose.model<ICategory>("Category");
        while (await Category.exists({ slug: candidate, _id: { $ne: this._id } })) {
            candidate = `${base}-${i}`;
            i++;
        }
        this.slug = candidate;
    }
    next();
})

export const Category = mongoose.model<ICategory>("Category", CategorySchema, "categories");