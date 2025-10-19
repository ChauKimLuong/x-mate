import express from "express";
import session from "express-session";
import flash from "express-flash";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

dotenv.config();

import { connect as connectDB } from "./config/database";
connectDB();

import adminRouter from "./routes/admin/index.route";
import clientRoutes from "./routes/client/index.route";
import cartQuantityMiddleware from "./middlewares/client/cartQuantity.middleware";
import navCategoriesMiddleware from "./middlewares/client/navCategories.middleware";

const app = express();
const PORT = process.env.PORT || 3000;

// Static & view engine
app.use(express.static("public"));
app.set("views", "./views");
app.set("view engine", "pug");

// Parsers
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session & flash
app.use(
  session({
    secret: process.env.SESSION_SECRET || "x-mate-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60_000 },
  })
);
app.use(flash());

// Global middlewares for client pages
app.use(navCategoriesMiddleware);
app.use(cartQuantityMiddleware);

// Routes
clientRoutes(app);
app.use("/admin", adminRouter);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server on http://localhost:${PORT}`);
});
