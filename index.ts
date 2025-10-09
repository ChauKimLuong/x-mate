import express, { Request, Response, NextFunction } from "express";
import session from "express-session";
import flash from "express-flash";
import dotenv from "dotenv";
import path from "path";
dotenv.config();

import { connect as connectDB } from "./config/database";
connectDB();
import adminRouter from "./routes/admin/index.route";
import clientRoutes from "./routes/client/index.route";
const app = express();
const PORT = process.env.PORT || 3000;

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

clientRoutes(app);
app.use("/admin", adminRouter);
app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
