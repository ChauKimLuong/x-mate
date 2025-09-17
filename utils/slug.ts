import slugify from "slugify";
import prisma from "../config/database";

/** Tạo slug cơ bản */
export const makeSlug = (s: string) =>
    slugify(s, { lower: true, strict: true, locale: "vi", trim: true });

/** Đảm bảo slug duy nhất cho Category */
export async function makeUniqueCategorySlug(
    title: string,
    currentId?: string
) {
    const base = makeSlug(title);
    let candidate = base;
    let i = 2;

    while (true) {
        const exists = await prisma.category.findFirst({
            where: {
                slug: candidate,
                ...(currentId ? { NOT: { id: currentId } } : {}),
            },
            select: { id: true },
        });
        if (!exists) return candidate;
        candidate = `${base}-${i++}`;
    }
}

/** Đảm bảo slug duy nhất cho Product */
export async function makeUniqueProductSlug(title: string, currentId?: string) {
    const base = makeSlug(title);
    let candidate = base;
    let i = 2;

    while (true) {
        const exists = await prisma.product.findFirst({
            where: {
                slug: candidate,
                ...(currentId ? { NOT: { id: currentId } } : {}),
            },
            select: { id: true },
        });
        if (!exists) return candidate;
        candidate = `${base}-${i++}`;
    }
}
