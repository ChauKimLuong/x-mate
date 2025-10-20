"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPrimaryNav = exports.FEMALE_SLUG = exports.MALE_SLUG = void 0;
exports.MALE_SLUG = "nam";
exports.FEMALE_SLUG = "nu";
const buildPrimaryNav = (categories) => {
    const idMap = new Map();
    categories.forEach((cat) => idMap.set(cat.id, cat));
    const groups = {};
    const ensureGroup = (slug, title) => {
        if (!groups[slug]) {
            groups[slug] = {
                slug,
                title,
                children: [],
            };
        }
        return groups[slug];
    };
    const male = categories.find((cat) => cat.slug === exports.MALE_SLUG);
    const female = categories.find((cat) => cat.slug === exports.FEMALE_SLUG);
    if (male) {
        ensureGroup(exports.MALE_SLUG, male.title);
    }
    if (female) {
        ensureGroup(exports.FEMALE_SLUG, female.title);
    }
    categories.forEach((cat) => {
        if (!cat.parentId)
            return;
        const parent = idMap.get(cat.parentId);
        if (!parent)
            return;
        if (parent.slug === exports.MALE_SLUG || parent.slug === exports.FEMALE_SLUG) {
            const rootGroup = ensureGroup(parent.slug, parent.title);
            let column = rootGroup.children.find((child) => child.slug === cat.slug);
            if (!column) {
                column = { title: cat.title, slug: cat.slug, items: [] };
                rootGroup.children.push(column);
            }
            return;
        }
        const grandParent = parent.parentId ? idMap.get(parent.parentId) : null;
        if (!grandParent)
            return;
        if (grandParent.slug === exports.MALE_SLUG || grandParent.slug === exports.FEMALE_SLUG) {
            const rootGroup = ensureGroup(grandParent.slug, grandParent.title);
            let column = rootGroup.children.find((child) => child.slug === parent.slug);
            if (!column) {
                column = { title: parent.title, slug: parent.slug, items: [] };
                rootGroup.children.push(column);
            }
            column.items.push({ title: cat.title, slug: cat.slug });
        }
    });
    return [groups[exports.MALE_SLUG], groups[exports.FEMALE_SLUG]].filter(Boolean);
};
exports.buildPrimaryNav = buildPrimaryNav;
