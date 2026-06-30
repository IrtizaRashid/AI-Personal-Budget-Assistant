// Controller for budget-category endpoints.
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as categoryService from '../services/categoryService.js';

// POST /api/categories
// Body: an ARRAY of categories (the recommended budget split).
export const createCategories = asyncHandler(async (req, res) => {
  const categories = req.body;

  if (!Array.isArray(categories) || categories.length === 0) {
    return res
      .status(400)
      .json({ error: 'Request body must be a non-empty array of categories' });
  }

  // Validate each item has the required fields.
  for (const c of categories) {
    if (!c.user_id || !c.category_name || c.allocated_amount === undefined) {
      return res.status(400).json({
        error:
          'Each category requires user_id, category_name and allocated_amount',
      });
    }
  }

  const inserted = await categoryService.createCategories(categories);
  res.status(201).json({
    message: 'Categories saved',
    inserted,
  });
});

// POST /api/categories/transfer
// Body: { userId, fromCategory, amount }
// Moves allocated_amount from one category into Savings.
export const transferToSavings = asyncHandler(async (req, res) => {
  const { userId, fromCategory, amount } = req.body;
  if (!userId || !fromCategory || !amount) {
    return res.status(400).json({ message: 'userId, fromCategory, and amount are required.' });
  }
  const result = await categoryService.transferToSavings(userId, fromCategory, Number(amount));
  res.status(200).json({ success: true, ...result });
});

// GET /api/categories/:userId
// Returns each category with a CALCULATED remaining_amount.
export const getCategories = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const rows = await categoryService.getCategoriesByUser(userId);

  // Shape the response for the dashboard: { category, allocated, spent, remaining }.
  // Remaining = Allocated - Spent  (computed here, never stored in the DB).
  const categories = rows.map((c) => {
    const allocated = Number(c.allocated_amount);
    const spent = Number(c.spent_amount);
    return {
      category: c.category_name,
      allocated,
      spent,
      remaining: allocated - spent,
    };
  });

  res.status(200).json(categories);
});
