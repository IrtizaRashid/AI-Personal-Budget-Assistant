import { asyncHandler } from '../middleware/asyncHandler.js';
import * as investmentService from '../services/investmentService.js';
import { resolveExpenseDate } from '../utils/dateParser.js';
import { parseTime } from '../utils/timeParser.js';

export const getPortfolio = asyncHandler(async (req, res) => {
  const portfolio = await investmentService.getPortfolio(req.params.userId);
  res.json(portfolio);
});

export const getSummary = asyncHandler(async (req, res) => {
  const summary = await investmentService.getInvestmentSummary(req.params.userId);
  res.json(summary);
});

export const getTransactions = asyncHandler(async (req, res) => {
  const txs = await investmentService.getInvestmentTransactions(req.params.userId);
  res.json(txs);
});

export const buy = asyncHandler(async (req, res) => {
  const { userId, name, type, amount, quantity, date, time, notes } = req.body;
  if (!userId || !name || !amount) {
    return res.status(400).json({ message: 'userId, name and amount are required.' });
  }
  const result = await investmentService.buyInvestment({
    userId: Number(userId), name, type, amount: Number(amount),
    quantity: quantity ? Number(quantity) : null,
    purchaseDate: resolveExpenseDate(date || null),
    purchaseTime: time ? (parseTime(time) ?? null) : null,
    notes: notes || null,
  });
  res.status(201).json(result);
});

export const sell = asyncHandler(async (req, res) => {
  const { userId, investmentId, saleAmount, saleQuantity, date, time, notes } = req.body;
  if (!userId || !investmentId || !saleAmount) {
    return res.status(400).json({ message: 'userId, investmentId and saleAmount are required.' });
  }
  const result = await investmentService.sellInvestment({
    investmentId: Number(investmentId), userId: Number(userId),
    saleAmount: Number(saleAmount),
    saleQuantity: saleQuantity ? Number(saleQuantity) : null,
    saleDate: resolveExpenseDate(date || null),
    saleTime: time ? (parseTime(time) ?? null) : null,
    notes: notes || null,
  });
  res.json(result);
});

export const dividend = asyncHandler(async (req, res) => {
  const { userId, investmentId, investmentName, amount, type, date, time, notes } = req.body;
  if (!userId || !amount) {
    return res.status(400).json({ message: 'userId and amount are required.' });
  }
  const result = await investmentService.addDividend({
    userId: Number(userId),
    investmentId: investmentId ? Number(investmentId) : null,
    investmentName: investmentName || null,
    amount: Number(amount),
    type: type || 'dividend',
    txDate: resolveExpenseDate(date || null),
    txTime: time ? (parseTime(time) ?? null) : null,
    notes: notes || null,
  });
  res.json(result);
});
