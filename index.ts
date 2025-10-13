import express, { Request, Response, NextFunction } from "express";
import session from "express-session";
import flash from "express-flash";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

dotenv.config();

import { connect as connectDB } from "./config/database";
connectDB();

import clientRoutes from "./routes/client/index.route";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cookieParser());
app.use(express.static("public"));
app.set("views", "./views");
app.set("view engine", "pug");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
    session({
        secret: "x-mate-secret",
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 60000 },
    })
);
app.use(flash());

app.use((req: Request, res: Response, next: NextFunction) => {
    const sessionCart = (req.session as any)?.cart;
    const cartQuantity = Array.isArray(sessionCart)
        ? sessionCart.reduce(
              (total: number, item: { quantity?: number }) =>
                  total + (typeof item?.quantity === "number" ? item.quantity : 0),
              0
          )
        : 0;

    res.locals.cartQuantity = cartQuantity;
    next();
});

clientRoutes(app);

app.listen(PORT, () => {
    console.log(`Server dang chay tai http://localhost:${PORT}`);
});
