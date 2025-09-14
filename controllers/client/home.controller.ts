import { Request, Response } from "express";
import Product from "../../models/product.model"

export const index = async (req: Request, res: Response) => {
    try {
        const products = await Product.find();
        res.render("client/pages/home/index", { 
            products: products
        });
    } catch (error) {
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
};