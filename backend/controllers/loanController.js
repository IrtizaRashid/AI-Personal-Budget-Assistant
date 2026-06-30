import { asyncHandler } from '../middleware/asyncHandler.js';
import * as loanService from '../services/loanService.js';
import * as expenseService from '../services/expenseService.js';
import * as categoryService from '../services/categoryService.js';
import * as userService from '../services/userService.js';

// GET /api/loans/:userId
export const getLoans = asyncHandler(async (req, res) => {
  const loans = await loanService.getLoansByUser(req.params.userId);
  return res.status(200).json(loans);
});

// POST /api/loans
export const createLoan = asyncHandler(async (req, res) => {
  const { userId, type, personName, amount, description, loanDate } = req.body;
  if (!userId || !type || !personName || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'userId, type, personName, and a positive amount are required.' });
  }
  if (!['given', 'taken'].includes(type)) {
    return res.status(400).json({ error: 'type must be "given" or "taken".' });
  }
  const loan = await loanService.addLoan({
    userId,
    type,
    personName,
    amount: Number(amount),
    description: description || null,
    loanDate: loanDate || null,
  });
  return res.status(201).json(loan);
});

// PUT /api/loans/:loanId/paid
export const markPaid = asyncHandler(async (req, res) => {
  const loan = await loanService.getLoanById(req.params.loanId);
  if (!loan) return res.status(404).json({ error: 'Loan not found.' });
  await loanService.markLoanPaid(req.params.loanId);
  return res.status(200).json({ success: true });
});

// PUT /api/loans/:loanId
export const updateLoan = asyncHandler(async (req, res) => {
  const loan = await loanService.getLoanById(req.params.loanId);
  if (!loan) return res.status(404).json({ error: 'Loan not found.' });
  const { person_name, amount, description, notes } = req.body;
  await loanService.updateLoan(req.params.loanId, { person_name, amount, description, notes });
  return res.status(200).json({ success: true });
});

// DELETE /api/loans/:loanId
export const removeLoan = asyncHandler(async (req, res) => {
  const deleted = await loanService.deleteLoan(req.params.loanId);
  if (!deleted) return res.status(404).json({ error: 'Loan not found.' });
  return res.status(200).json({ success: true });
});

// GET /api/loans/:userId/summary
export const getLoanSummary = asyncHandler(async (req, res) => {
  const summary = await loanService.getLoanSummaryByUser(req.params.userId);
  return res.status(200).json(summary);
});

// GET /api/loans/:loanId/payments
export const getLoanPayments = asyncHandler(async (req, res) => {
  const payments = await loanService.getLoanPayments(req.params.loanId);
  return res.status(200).json(payments);
});

// POST /api/loans/split — called by SharedSplitCard after user picks a split type
export const createSplitExpense = asyncHandler(async (req, res) => {
  const { userId, total, category, description, paidBy, splits } = req.body;
  if (!userId || !total || Number(total) <= 0 || !Array.isArray(splits) || splits.length === 0) {
    return res.status(400).json({ error: 'userId, total, and splits are required.' });
  }

  const totalAmt = Number(total);
  const iAmPayer = !paidBy || ['me', 'i', 'myself'].includes(String(paidBy).toLowerCase());
  const result = { success: true, expense: null, loans: [], myShare: 0 };

  const user = await userService.findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  // Resolve category against user's real categories
  const cats = await categoryService.getCategoriesByUser(userId);
  const validCatNames = cats.map((c) => c.category_name);
  const matchedCat =
    validCatNames.find((c) => c.toLowerCase() === String(category || '').toLowerCase()) ||
    validCatNames.find((c) => c.toLowerCase().includes(String(category || '').toLowerCase())) ||
    null;

  if (iAmPayer) {
    // I paid the full bill — record it as an expense
    if (matchedCat) {
      try {
        result.expense = await expenseService.addExpenseWithCategoryUpdate({
          user_id: userId,
          category: matchedCat,
          amount: totalAmt,
          description: description || matchedCat,
        });
      } catch { /* over-budget — loans still recorded */ }
    }

    // Create a loan_given for each person's share
    const splitsTotal = splits.reduce((s, sp) => s + Number(sp.amount), 0);
    result.myShare = Math.max(0, totalAmt - splitsTotal);

    for (const sp of splits) {
      if (sp.person && Number(sp.amount) > 0) {
        const loan = await loanService.addLoan({
          userId, type: 'given', personName: sp.person,
          amount: Number(sp.amount), description: description || category || 'Shared expense',
        });
        result.loans.push(loan);
      }
    }

    const owedLines = result.loans.map((l) => `${l.person_name} owes you Rs ${Number(l.amount).toLocaleString()}`).join(', ');
    result.message = `Rs ${totalAmt.toLocaleString()} expense recorded.${owedLines ? ' ' + owedLines + '.' : ''}`;
  } else {
    // Someone else paid — I owe them my share (first split entry is "my" share)
    const myShare = Number(splits[0]?.amount) || 0;
    result.myShare = myShare;
    if (myShare > 0) {
      const loan = await loanService.addLoan({
        userId, type: 'taken', personName: paidBy,
        amount: myShare, description: description || category || 'Shared expense',
      });
      result.loans.push(loan);
    }
    result.message = `You owe ${paidBy} Rs ${myShare.toLocaleString()} for ${description || 'shared expense'}.`;
  }

  return res.status(200).json(result);
});
