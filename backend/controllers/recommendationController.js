// Controller for AI financial recommendations.
//
// IMPORTANT: the AI never touches the database. THIS controller collects a
// structured financial summary from MySQL and passes only that summary to the
// AI, which returns short advice. The AI makes no changes and runs no SQL.
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as userService from '../services/userService.js';
import * as categoryService from '../services/categoryService.js';
import * as expenseService from '../services/expenseService.js';
import * as groqService from '../services/groqService.js';

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

  // Aggregate per-category expense counts so the AI can spot activity patterns.
  const expenseCountByCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1;
    return acc;
  }, {});

  // Enrich each category with expense count and a clear status flag.
  const categoriesEnriched = categories
    .map((c) => ({
      ...c,
      expenseCount: expenseCountByCategory[c.category] || 0,
      status:
        c.spentPercent >= 100 ? 'OVER_BUDGET' :
        c.spentPercent >= 75  ? 'NEAR_LIMIT'  :
        c.spentPercent >= 50  ? 'MODERATE'    :
        c.spentPercent > 0    ? 'LOW'         : 'UNUSED',
    }))
    .sort((a, b) => b.spentPercent - a.spentPercent); // highest usage first

  const summary = {
    monthlyBudget,
    totalSpent,
    remainingBudget: monthlyBudget - totalSpent,
    budgetUsedPercent:
      monthlyBudget > 0 ? Math.round((totalSpent / monthlyBudget) * 100) : 0,
    // Full per-category breakdown — the AI must address each category
    categories: categoriesEnriched,
    overBudgetCategories:  categoriesEnriched.filter((c) => c.status === 'OVER_BUDGET').map((c) => c.category),
    nearLimitCategories:   categoriesEnriched.filter((c) => c.status === 'NEAR_LIMIT').map((c) => c.category),
    unusedCategories:      categoriesEnriched.filter((c) => c.status === 'UNUSED').map((c) => c.category),
    recentExpenses: expenses.slice(0, 8).map((e) => ({
      category: e.category,
      amount: Number(e.amount),
      description: e.description,
    })),
  };

  // --- Ask the AI to analyse the summary ---
  // Failures are surfaced as 502 so the frontend can show its fallback message.
  try {
    const recommendations = await groqService.generateRecommendations(summary);
    return res.status(200).json({ recommendations });
  } catch (err) {
    return res
      .status(502)
      .json({ error: err.message || 'AI recommendations are unavailable.' });
  }
});
