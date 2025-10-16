"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const home_route_1 = __importDefault(require("./home.route"));
const category_route_1 = __importDefault(require("./category.route"));
const auth_route_1 = __importDefault(require("./auth.route"));
const product_route_1 = __importDefault(require("./product.route"));
const clientRoutes = (app) => {
    app.use("/", home_route_1.default);
    app.use("/categories", category_route_1.default);
    app.use("/auth", auth_route_1.default);
    app.use("/product", product_route_1.default);
};
exports.default = clientRoutes;
