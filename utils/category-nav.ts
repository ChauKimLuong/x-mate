export const MALE_SLUG = "nam";
export const FEMALE_SLUG = "nu";

export interface CategoryNavItem {
  slug: string;
  title: string;
  children: CategoryGroup[];
}

export interface CategoryGroup {
  title: string;
  slug: string;
  items: Array<{ title: string; slug: string }>;
}

interface CategoryRow {
  id: string;
  title: string;
  slug: string;
  parentId: string | null;
}

export const buildPrimaryNav = (categories: CategoryRow[]): CategoryNavItem[] => {
  const idMap = new Map<string, CategoryRow>();
  categories.forEach((cat) => idMap.set(cat.id, cat));

  const groups: Record<string, CategoryNavItem> = {};

  const ensureGroup = (slug: string, title: string) => {
    if (!groups[slug]) {
      groups[slug] = {
        slug,
        title,
        children: [],
      };
    }
    return groups[slug];
  };

  // Pre-create root groups for NAM and NỮ if present
  const male = categories.find((cat) => cat.slug === MALE_SLUG);
  const female = categories.find((cat) => cat.slug === FEMALE_SLUG);

  if (male) {
    ensureGroup(MALE_SLUG, male.title);
  }

  if (female) {
    ensureGroup(FEMALE_SLUG, female.title);
  }

  categories.forEach((cat) => {
    if (!cat.parentId) return;
    const parent = idMap.get(cat.parentId);
    if (!parent) return;

    if (parent.slug === MALE_SLUG || parent.slug === FEMALE_SLUG) {
      const rootGroup = ensureGroup(parent.slug, parent.title);
      let column = rootGroup.children.find((child) => child.slug === cat.slug);
      if (!column) {
        column = { title: cat.title, slug: cat.slug, items: [] };
        rootGroup.children.push(column);
      }
      return;
    }

    const grandParent = parent.parentId ? idMap.get(parent.parentId) : null;
    if (!grandParent) return;

    if (grandParent.slug === MALE_SLUG || grandParent.slug === FEMALE_SLUG) {
      const rootGroup = ensureGroup(grandParent.slug, grandParent.title);
      let column = rootGroup.children.find((child) => child.slug === parent.slug);
      if (!column) {
        column = { title: parent.title, slug: parent.slug, items: [] };
        rootGroup.children.push(column);
      }
      column.items.push({ title: cat.title, slug: cat.slug });
    }
  });

  return [groups[MALE_SLUG], groups[FEMALE_SLUG]].filter(Boolean) as CategoryNavItem[];
};
