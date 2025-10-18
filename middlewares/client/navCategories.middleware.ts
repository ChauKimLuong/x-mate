import { NextFunction, Request, Response } from "express";
import prisma from "../../config/database";
import { buildPrimaryNav } from "../../utils/category-nav";

const CACHE_TTL = 5 * 60 * 1000;

let cachedNav: { data: ReturnType<typeof buildPrimaryNav>; expires: number } = {
  data: [],
  expires: 0,
};

export const navCategoriesMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (Array.isArray(res.locals.primaryCategories) && res.locals.primaryCategories.length) {
    return next();
  }

  const now = Date.now();
  if (cachedNav.data.length && now < cachedNav.expires) {
    res.locals.primaryCategories = cachedNav.data;
    return next();
  }

  try {
    const categories = await prisma.categories.findMany({
      where: { status: { equals: "active" } },
      select: {
        id: true,
        title: true,
        slug: true,
        parentId: true,
      },
    });

    const nav = buildPrimaryNav(categories);
    cachedNav = {
      data: nav,
      expires: now + CACHE_TTL,
    };
    res.locals.primaryCategories = nav;
  } catch (error) {
    console.error("NAV CATEGORIES ERROR:", error);
    res.locals.primaryCategories = cachedNav.data || [];
  }

  next();
};

export default navCategoriesMiddleware;
