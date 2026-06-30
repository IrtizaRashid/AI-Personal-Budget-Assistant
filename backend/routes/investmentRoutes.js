import express from 'express';
import * as ctrl from '../controllers/investmentController.js';

const router = express.Router();

router.get('/:userId/portfolio',     ctrl.getPortfolio);
router.get('/:userId/summary',       ctrl.getSummary);
router.get('/:userId/transactions',  ctrl.getTransactions);
router.post('/buy',                  ctrl.buy);
router.post('/sell',                 ctrl.sell);
router.post('/dividend',             ctrl.dividend);

export default router;
