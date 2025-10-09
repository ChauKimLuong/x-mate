import { Request, Response } from "express";
import prisma from "../../config/database";


// [GET] /user/info
export const info = async (req: Request, res: Response) => {
    try {
        const user = await prisma.users.findFirst({
            where: { 
                status: "active",
                token_user: "tok_izr1yfxb5q"
            },
            select: {
                id: true,
                full_name: true,
                phone: true,
                gender: true,
                dob: true,
                weight_kg: true,
                height_cm: true,
                email: true
            }
        });

        if (!user) {
            return res.status(404).render("client/pages/user/info", { userInfo: null });
        }
        
        res.render("client/pages/user/info", 
            { 
                user: user
            }
        );

    } catch (error) {
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
}


// [GET] /user/address
export const address = async (req: Request, res: Response) => {
    try {
        const user = await prisma.users.findFirst({
            where: { 
                status: "active",
                token_user: "tok_izr1yfxb5q"
            },
            select: {
                address: true,
            }
        });

        if (!user) {
            return res.status(404).render("client/pages/user/address", 
                { user: user }
            );
        }

        res.render("client/pages/user/address", 
            { 
                user: user
            }
        );

    } catch (error) {
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
}