import { Request, Response } from "express";
import prisma from "../../config/database";

// [GET] /auth/login
export const login = async (req: Request, res: Response) => {
    res.render("client/pages/user/login");
};

// [POST] /auth/login
export const loginPost = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
        // Find user by email
        
    } catch (error) {
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
};

// [GET] /auth/register
export const register = async (req: Request, res: Response) => {
    res.render("client/pages/user/register");
};

// [POST] /auth/register
export const registerPost = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
        
    } catch (error) {
        console.error("ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
};