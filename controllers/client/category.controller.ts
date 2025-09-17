import { Request, Response } from "express";
import { Category } from "../../models/category.model";

export const index = async (req: Request, res: Response) => {
    try {
        const categories = await Category.find({ deleted: false }).sort({ position: 1, title: 1 });
        res.send({ categories });
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
