"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const express_flash_1 = __importDefault(require("express-flash"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const database_1 = require("./config/database");
(0, database_1.connect)();
const index_route_1 = __importDefault(require("./routes/admin/index.route"));
const index_route_2 = __importDefault(require("./routes/client/index.route"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.static("public"));
app.set("views", "./views");
app.set("view engine", "pug");
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.json());
app.use((0, express_session_1.default)({
    secret: "x-mate-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60000 },
}));
app.use((0, express_flash_1.default)());
(0, index_route_2.default)(app);
app.use("/admin", index_route_1.default);
app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
