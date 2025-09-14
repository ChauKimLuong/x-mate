import express, { Request, Response } from "express";
import dotenv from "dotenv";
dotenv.config();

import { connect as connectDB } from "./config/database";
connectDB();  

import clientRoutes from "./routes/client/index.route";
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.set("views", "./views");
app.set("view engine", "pug");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
clientRoutes(app);

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});