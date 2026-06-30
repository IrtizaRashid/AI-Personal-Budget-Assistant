import { asyncHandler } from '../middleware/asyncHandler.js';
import * as incomeService from '../services/incomeService.js';

// GET /api/income/:userId
export const getIncome = asyncHandler(async (req, res) => {
  const records = await incomeService.getIncomeByUser(req.params.userId);
  return res.status(200).json(records);
});

// POST /api/income
export const createIncome = asyncHandler(async (req, res) => {
  const { userId, amount, source, description, receivedDate, receivedTime, recurring } = req.body;
  if (!userId || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'userId and a positive amount are required.' });
  }
  const record = await incomeService.addIncome({
    userId,
    amount: Number(amount),
    source: source || null,
    description: description || null,
    receivedDate: receivedDate || null,
    receivedTime: receivedTime || null,
    recurring: !!recurring,
  });
  return res.status(201).json(record);
});

// DELETE /api/income/:incomeId
export const removeIncome = asyncHandler(async (req, res) => {
  const deleted = await incomeService.deleteIncomeById(req.params.incomeId);
  if (!deleted) return res.status(404).json({ error: 'Income record not found.' });
  return res.status(200).json({ success: true });
});
