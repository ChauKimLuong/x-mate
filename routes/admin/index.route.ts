import { Router } from 'express';
import dashboard from './products.route'; // nếu bạn đã có, cứ giữ import khác
import productsRouter from './products.route';

import usersRouter from './users.route';
import reportsRouter from './reports.route';
import promotionsRouter from './promotions.route';
import inventoryRouter from './inventory.route';
import inventorySupportRouter from './inventory-support.route';
import reviewsRouter from './reviews.route';
import ordersRouter from './orders.route';

import * as dashCtrl from '../../controllers/admin/dashboard.controller';

const router = Router();

// Dashboard (overview)
router.get('/', dashCtrl.index);

// Sub-modules
router.use('/users', usersRouter);
router.use('/reports', reportsRouter);
router.use('/promotions', promotionsRouter);
router.use('/products', productsRouter);
router.use('/inventory', inventoryRouter);
router.use('/inventory-support', inventorySupportRouter);
router.use('/reviews', reviewsRouter);
router.use('/orders', ordersRouter);

export default router;
