import { Router } from 'express';
import { getLoans, createLoan, markPaid, updateLoan, removeLoan, getLoanSummary, createSplitExpense, getLoanPayments } from '../controllers/loanController.js';

const router = Router();

// Specific routes must come before parameterised ones
router.post('/split', createSplitExpense);
router.get('/:userId/summary', getLoanSummary);
router.get('/:userId', getLoans);
router.post('/', createLoan);
router.get('/:loanId/payments', getLoanPayments);
router.put('/:loanId/paid', markPaid);
router.put('/:loanId', updateLoan);
router.delete('/:loanId', removeLoan);

export default router;
