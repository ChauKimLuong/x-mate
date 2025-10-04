import { Request, Response } from "express";
import prisma from "../../config/database";

export const index = async (req: Request, res: Response) => {
    try {
        const products = await prisma.products.findMany();

        console.log(products);
        res.render("client/pages/home/index", { 
            products: products
        });
    } catch (error) {
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
};