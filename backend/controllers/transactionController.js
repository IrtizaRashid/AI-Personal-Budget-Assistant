import { asyncHandler } from '../middleware/asyncHandler.js';
import { getTransactionHistory, recordMiscTransaction } from '../services/transactionService.js';

// GET /api/transactions/:userId
export const getTransactions = asyncHandler(async (req, res) => {
  const transactions = await getTransactionHistory(req.params.userId);
  res.status(200).json(transactions);
});

// POST /api/transactions  — record a misc transaction manually (budget transfer, adjustment, etc.)
// Body: { userId, type, amount, category, description, person, notes, txDate, txTime }
export const createTransaction = asyncHandler(async (req, res) => {
  const { userId, type, amount, category, description, person,
          investmentName, loanId, investmentId, notes, txDate, txTime } = req.body;
  if (!userId || !type || amount === undefined) {
    return res.status(400).json({ error: 'userId, type, and amount are required.' });
  }
  const id = await recordMiscTransaction({
    userId, type, amount, category, description, person,
    investmentName, loanId, investmentId, notes, txDate, txTime,
  });
  res.status(201).json({ success: true, id });
});
