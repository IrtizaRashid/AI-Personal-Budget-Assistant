// Controller for budget setup and later allocation changes.
// Requires authentication and uses req.user.userId from JWT.
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as setupService from '../services/setupService.js';
import * as categoryService from '../services/categoryService.js';

const EPSILON = 0.01;

const validateBudgetPayload = ({ monthlyBudget, categories }) => {
  const budget = Number(monthlyBudget);
  if (isNaN(budget) || budget <= 0) {
    return { error: 'Monthly budget must be greater than zero.' };
  }

  if (!Array.isArray(categories) || categories.length === 0) {
    return { error: 'At least one budget category is required.' };
  }

  let totalAmount = 0;
  let totalPercentage = 0;
  const hasPercentages = categories.every((c) => c.percentage !== undefined);

  for (const c of categories) {
    if (!c.category || !String(c.category).trim()) {
      return { error: 'Every category must have a name.' };
    }

    const amount = Number(c.allocatedAmount);
    if (isNaN(amount) || amount < 0) {
      return { error: `Amount for "${c.category}" cannot be negative.` };
    }
    if (amount > budget) {
      return { error: `Amount for "${c.category}" cannot exceed the total income.` };
    }

    totalAmount += amount;

    if (hasPercentages) {
      const percentage = Number(c.percentage);
      if (isNaN(percentage) || percentage < 0) {
        return { error: `Percentage for "${c.category}" cannot be negative.` };
      }
      totalPercentage += percentage;
    }
  }

  if (Math.abs(totalAmount - budget) > EPSILON) {
    return {
      error: `Category amounts add up to ${totalAmount}, but your monthly budget is ${budget}. They must be equal.`,
    };
  }

  if (hasPercentages && Math.abs(totalPercentage - 100) > EPSILON) {
    return {
      error: `Category percentages add up to ${totalPercentage}, but they must equal 100.`,
    };
  }

  return { budget };
};

// POST /api/setup-budget
export const setupBudget = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { monthlyBudget, categories } = req.body;

  const validation = validateBudgetPayload({ monthlyBudget, categories });
  if (validation.error) return res.status(400).json({ error: validation.error });

  await setupService.setupBudgetForUser({
    userId,
    monthlyBudget: validation.budget,
    categories,
  });

  res.status(201).json({
    message: 'Budget setup completed successfully.',
    userId,
  });
});

// PUT /api/budget-allocation
export const updateBudgetAllocation = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { monthlyBudget, categories } = req.body;

  const validation = validateBudgetPayload({ monthlyBudget, categories });
  if (validation.error) return res.status(400).json({ error: validation.error });

  const existing = await categoryService.getCategoriesByUser(userId);
  const existingNames = new Set(existing.map((c) => c.category_name));
  const unknown = categories.find((c) => !existingNames.has(c.category));

  if (unknown) {
    return res.status(400).json({
      error: `Unknown category "${unknown.category}". Existing expenses and categories are preserved during reallocation.`,
    });
  }

  await setupService.updateBudgetAllocationForUser({
    userId,
    monthlyBudget: validation.budget,
    categories,
  });

  res.status(200).json({
    message: 'Budget allocation updated successfully.',
    userId,
  });
});
