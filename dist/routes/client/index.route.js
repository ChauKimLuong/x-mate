"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const home_route_1 = __importDefault(require("./home.route"));
const category_route_1 = __importDefault(require("./category.route"));
const auth_route_1 = __importDefault(require("./auth.route"));
const product_route_1 = __importDefault(require("./product.route"));
const user_route_1 = __importDefault(require("./user.route"));
const cart_route_1 = __importDefault(require("./cart.route"));
const clientRoutes = (app) => {
    app.use("/", home_route_1.default);
    app.use("/categories", category_route_1.default);
    app.use("/auth", auth_route_1.default);
    app.use("/product", product_route_1.default);
    app.use("/user", user_route_1.default);
    app.use("/cart", cart_route_1.default);
};
exports.default = clientRoutes;
