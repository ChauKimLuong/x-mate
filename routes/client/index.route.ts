import { Express } from 'express';

import homeRoutes from './home.route';
import categoryRoutes from './category.route';
import authRoutes from './auth.route';
import productRoutes from './product.route';
import userRoutes from './user.route';
import cartRoutes from './cart.route';

const clientRoutes = (app: Express): void => {
    app.use("/", homeRoutes);
    app.use("/categories", categoryRoutes);
    app.use("/auth", authRoutes);
    app.use("/product", productRoutes);
    app.use("/user", userRoutes);
    app.use("/cart", cartRoutes);
}


export default clientRoutes;
