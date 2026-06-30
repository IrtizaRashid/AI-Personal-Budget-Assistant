import { Router } from 'express';
import { getTransactions, createTransaction } from '../controllers/transactionController.js';

const router = Router();
router.get('/:userId', getTransactions);   // GET  /api/transactions/:userId
router.post('/', createTransaction);        // POST /api/transactions
export default router;
