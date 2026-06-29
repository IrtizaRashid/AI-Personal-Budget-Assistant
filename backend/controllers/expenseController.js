// Controller for expense endpoints.
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as expenseService from '../services/expenseService.js';
import * as categoryService from '../services/categoryService.js';
import * as userService from '../services/userService.js';
import { buildBudgetWarning } from '../utils/budgetWarning.js';
import { resolveExpenseDate } from '../utils/dateParser.js';

// Helper: build the budget warning for a category's CURRENT state.
const warningFor = async (userId, category) => {
  const cat = await categoryService.getCategoryByName(userId, category);
  return cat
    ? buildBudgetWarning(
        category,
        Number(cat.allocated_amount),
        Number(cat.spent_amount)
      )
    : null;
};

// Helper: would adding `amount` push total spending past the monthly budget?
// Used to guarantee the OVERALL remaining budget never goes negative.
const wouldExceedOverallBudget = async (userId, amount) => {
  const user = await userService.findUserById(userId);
  if (!user) return false;
  const totalSpent = await expenseService.getTotalSpentByUser(userId);
  return totalSpent + Number(amount) > Number(user.monthly_budget) + 1e-6;
};

// POST /api/expenses
// Body: { user_id, category, amount, description?, expense_date? }
export const createExpense = asyncHandler(async (req, res) => {
  const { user_id, category, amount, description, expense_date } = req.body;

  if (!user_id || !category || amount === undefined) {
    return res
      .status(400)
      .json({ error: 'user_id, category and amount are required' });
  }

  if (isNaN(Number(amount)) || Number(amount) <= 0) {
    return res
      .status(400)
      .json({ error: 'amount must be a positive number' });
  }

  const expense = await expenseService.createExpense({
    user_id,
    category,
    amount,
    description,
    expense_date,
  });

  res.status(201).json(expense);
});

// GET /api/expenses/:userId  — latest first.
export const getExpenses = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const expenses = await expenseService.getExpensesByUser(userId);
  res.status(200).json(expenses);
});

// DELETE /api/expenses/:expenseId
// Removes the expense and decrements the category's spent_amount.
export const deleteExpense = asyncHandler(async (req, res) => {
  const { expenseId } = req.params;

  if (!expenseId || isNaN(Number(expenseId))) {
    return res.status(400).json({ error: 'Invalid expense id.' });
  }

  const deleted = await expenseService.deleteExpenseWithCategoryUpdate(expenseId);
  if (!deleted) {
    return res.status(404).json({ error: 'Expense not found.' });
  }

  res.status(200).json({
    success: true,
    message: 'Expense deleted.',
    expense: deleted,
  });
});

// POST /api/expenses/confirm
// Resolves an over-budget expense after the user chooses how to proceed.
// Body: { userId, action, expense: { category, amount, description }, fromCategory? }
//   action = 'transfer' | 'over_budget' | 'cancel'
export const confirmExpense = asyncHandler(async (req, res) => {
  const { userId, action, expense, fromCategory } = req.body;

  if (!userId) return res.status(400).json({ error: 'userId is required.' });
  if (!action) return res.status(400).json({ error: 'action is required.' });

  // Option 3: Cancel — make no database changes.
  if (action === 'cancel') {
    return res.status(200).json({ status: 'cancelled' });
  }

  // Validate the pending expense for the remaining actions.
  if (!expense || !expense.category || expense.amount === undefined) {
    return res.status(400).json({ error: 'Expense details are required.' });
  }
  const amount = Number(expense.amount);
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid expense amount.' });
  }
  const description = expense.description || expense.category;
  // Preserve the originally-resolved date so the confirmed expense lands on the
  // correct day, not the current time when the user clicked "confirm".
  const expenseDate = resolveExpenseDate(expense.date || null);

  // Duplicate override: user confirmed "Add Anyway" — insert without re-checking
  // the duplicate, but still protect the overall budget.
  if (action === 'add_anyway') {
    if (await wouldExceedOverallBudget(userId, amount)) {
      return res.status(400).json({
        error:
          'This expense would exceed your overall monthly budget. Delete an expense or lower the amount.',
      });
    }
    const saved = await expenseService.addExpenseWithCategoryUpdate({
      user_id: userId,
      category: expense.category,
      amount,
      description,
      expense_date: expenseDate,
    });
    return res.status(201).json({
      status: 'success',
      action: 'add_anyway',
      message: 'Expense added.',
      expense: saved,
      budgetWarning: await warningFor(userId, expense.category),
    });
  }

  // Option 2: Record as over-budget — a category may exceed its allocation,
  // but only while the OVERALL monthly budget still has room.
  if (action === 'over_budget') {
    if (await wouldExceedOverallBudget(userId, amount)) {
      return res.status(400).json({
        error:
          'This would exceed your overall monthly budget, so it can’t be recorded as over-budget. Transfer from another category, delete an expense, or cancel.',
      });
    }
    const saved = await expenseService.addExpenseWithCategoryUpdate({
      user_id: userId,
      category: expense.category,
      amount,
      description,
      expense_date: expenseDate,
    });

    // Compute how far over the allocation we now are, for a warning message.
    const cat = await categoryService.getCategoryByName(userId, expense.category);
    const over = cat
      ? Number(cat.spent_amount) - Number(cat.allocated_amount)
      : 0;

    return res.status(201).json({
      status: 'success',
      action: 'over_budget',
      message: 'Expense recorded as over-budget.',
      warning:
        over > 0 ? `${expense.category} budget exceeded by ${over}.` : null,
      expense: saved,
      budgetWarning: await warningFor(userId, expense.category),
    });
  }

  // Option 1: Transfer funds from another category, then record the expense.
  if (action === 'transfer') {
    if (!fromCategory) {
      return res
        .status(400)
        .json({ error: 'Please choose a category to transfer funds from.' });
    }
    if (fromCategory === expense.category) {
      return res
        .status(400)
        .json({ error: 'Cannot transfer from the same category.' });
    }

    try {
      // Calculate the shortage amount to show in the message.
      const toCat = await categoryService.getCategoryByName(userId, expense.category);
      const toRemaining = toCat
        ? Number(toCat.allocated_amount) - Number(toCat.spent_amount)
        : 0;
      const shortage = amount - toRemaining;

      const saved = await expenseService.transferFundsAndAddExpense({
        user_id: userId,
        toCategory: expense.category,
        fromCategory,
        amount,
        description,
        expense_date: expenseDate,
      });
      return res.status(201).json({
        status: 'success',
        action: 'transfer',
        message: `Transferred PKR ${shortage} from ${fromCategory} to ${expense.category}.`,
        expense: saved,
        budgetWarning: await warningFor(userId, expense.category),
      });
    } catch (err) {
      // Insufficient source funds -> a clean 400, not a 500.
      if (err.code === 'INSUFFICIENT_FUNDS') {
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }
  }

  return res.status(400).json({ error: `Unknown action: "${action}".` });
});
