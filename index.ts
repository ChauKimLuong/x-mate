import express from "express";
import session from "express-session";
import flash from "express-flash";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

dotenv.config();

import { connect as connectDB } from "./config/database";
connectDB();

import clientRoutes from "./routes/client/index.route";
import cartQuantityMiddleware from "./middlewares/client/cartQuantity.middleware";
import navCategoriesMiddleware from "./middlewares/client/navCategories.middleware";

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

app.use(navCategoriesMiddleware);
app.use(cartQuantityMiddleware);

clientRoutes(app);

app.listen(PORT, () => {
    console.log(`Server dang chay tai http://localhost:${PORT}`);
});
