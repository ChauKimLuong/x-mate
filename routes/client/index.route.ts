import { Express } from 'express';

import homeRoutes from './home.route';
import categoryRoutes from './category.route';

const clientRoutes = (app: Express): void => {
    app.use("/", homeRoutes);
    app.use("/categories", categoryRoutes);
}


export default clientRoutes;