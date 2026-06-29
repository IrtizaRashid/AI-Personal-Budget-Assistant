// Routes mounted at /api/expenses
import { Router } from 'express';
import {
  createExpense,
  getExpenses,
  deleteExpense,
  confirmExpense,
} from '../controllers/expenseController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/confirm', authenticate, confirmExpense);    // POST   /api/expenses/confirm
router.post('/', authenticate, createExpense);            // POST   /api/expenses
router.get('/:userId', authenticate, getExpenses);        // GET    /api/expenses/:userId
router.delete('/:expenseId', authenticate, deleteExpense); // DELETE /api/expenses/:expenseId

export default router;
