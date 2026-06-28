// Controller for AI financial recommendations.
//
// IMPORTANT: the AI never touches the database. THIS controller collects a
// structured financial summary from MySQL and passes only that summary to the
// AI, which returns short advice. The AI makes no changes and runs no SQL.
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as userService from '../services/userService.js';
import * as categoryService from '../services/categoryService.js';
import * as expenseService from '../services/expenseService.js';
import * as openaiService from '../services/openaiService.js';

// GET /api/ai/recommendations/:userId
export const getRecommendations = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await userService.findUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // --- Collect the financial summary from the database ---
  const [cats, totalSpent, expenses] = await Promise.all([
    categoryService.getCategoriesByUser(userId),
    expenseService.getTotalSpentByUser(userId),
    expenseService.getExpensesByUser(userId),
  ]);

  const monthlyBudget = Number(user.monthly_budget);

  const categories = cats.map((c) => {
    const allocated = Number(c.allocated_amount);
    const spent = Number(c.spent_amount);
    return {
      category: c.category_name,
      allocated,
      spent,
      remaining: allocated - spent,
      spentPercent: allocated > 0 ? Math.round((spent / allocated) * 100) : 0,
    };
  });

  // Only a small, summarised slice of data is sent to the AI.
  const summary = {
    monthlyBudget,
    totalSpent,
    remainingBudget: monthlyBudget - totalSpent,
    budgetUsedPercent:
      monthlyBudget > 0 ? Math.round((totalSpent / monthlyBudget) * 100) : 0,
    categories,
    recentExpenses: expenses.slice(0, 5).map((e) => ({
      category: e.category,
      amount: Number(e.amount),
      description: e.description,
    })),
  };

  // --- Ask the AI to analyse the summary ---
  // Failures are surfaced as 502 so the frontend can show its fallback message.
  try {
    const recommendations = await openaiService.generateRecommendations(summary);
    return res.status(200).json({ recommendations });
  } catch (err) {
    return res
      .status(502)
      .json({ error: err.message || 'AI recommendations are unavailable.' });
  }
});
