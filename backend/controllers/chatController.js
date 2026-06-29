// Chat controller — processes AI intents and executes them against the DB.
//
// Flow: React → here → Groq (classify only) → validate → DB → React
//
// The AI ONLY classifies intent. Every validation, calculation, and DB write
// happens here in our own code — the AI never touches the database.
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as groqService from '../services/groqService.js';
import * as expenseService from '../services/expenseService.js';
import * as userService from '../services/userService.js';
import * as categoryService from '../services/categoryService.js';
import { buildBudgetWarning } from '../utils/budgetWarning.js';
import {
  exceedsMonthlyBudget,
  monthlyBudgetExceeded,
} from '../utils/monthlyBudget.js';
import { resolveExpenseDate, resolveExpenseDateTime } from '../utils/dateParser.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Fetch the user's category names from the DB.
// Falls back to a default set if the user has no categories yet.
const getUserCategories = async (userId) => {
  const cats = await categoryService.getCategoriesByUser(userId);
  if (cats && cats.length > 0) {
    return cats.map((c) => c.category_name);
  }
  return ['Food', 'Transport', 'Bills', 'Entertainment', 'Savings', 'Miscellaneous'];
};

// Normalise a category string against the user's actual category list.
// Returns the matched category or null if no match.
const matchCategory = (raw, validCategories) => {
  if (!raw) return null;
  const normalised = String(raw).trim();
  // Exact match first
  const exact = validCategories.find(
    (c) => c.toLowerCase() === normalised.toLowerCase()
  );
  if (exact) return exact;
  // Partial match (e.g. "food" matches "Food & Dining")
  const partial = validCategories.find((c) =>
    c.toLowerCase().includes(normalised.toLowerCase()) ||
    normalised.toLowerCase().includes(c.toLowerCase())
  );
  return partial || null;
};

// Process a single add_expense intent. Returns a response object.
// Shared by both add_expense and add_multiple_expenses handlers.
const processSingleExpense = async (userId, rawCategory, amount, description, validCategories, user, expenseDate = null) => {
  const category = matchCategory(rawCategory, validCategories);
  if (!category) {
    return {
      success: false,
      error: `Unknown category "${rawCategory}". Your categories are: ${validCategories.join(', ')}.`,
    };
  }

  const amt = Number(amount);
  if (!amt || amt <= 0) {
    return { success: false, error: 'Amount must be greater than zero.' };
  }

  const desc = description || category;
  const monthlyBudget = Number(user.monthly_budget);
  const totalSpent = await expenseService.getTotalSpentByUser(userId);

  // Hard monthly limit check
  if (exceedsMonthlyBudget(monthlyBudget, totalSpent, amt)) {
    return {
      success: false,
      monthlyLimitExceeded: true,
      data: monthlyBudgetExceeded(monthlyBudget, totalSpent, amt),
    };
  }

  // Duplicate detection
  const duplicate = await expenseService.findRecentDuplicate(userId, category, amt, desc);
  if (duplicate) {
    return {
      success: false,
      duplicate: true,
      data: {
        status: 'duplicate_detected',
        message: 'A similar expense was recently recorded.',
        existingExpense: { category, amount: amt, description: desc },
      },
    };
  }

  // Insufficient category budget check
  const cat = await categoryService.getCategoryByName(userId, category);
  const remaining = cat
    ? Number(cat.allocated_amount) - Number(cat.spent_amount)
    : Infinity;

  if (amt > remaining) {
    return {
      success: false,
      confirmationRequired: true,
      data: {
        status: 'confirmation_required',
        message:
          remaining <= 0
            ? `Your ${category} budget has been exhausted.`
            : `Your ${category} budget only has ${remaining} remaining.`,
        expense: { category, amount: amt, description: desc },
        options: [
          { id: 1, title: 'Transfer money from another category' },
          { id: 2, title: 'Record as an over-budget expense' },
          { id: 3, title: 'Cancel this expense' },
        ],
      },
    };
  }

  // All checks passed — insert expense
  const expense = await expenseService.addExpenseWithCategoryUpdate({
    user_id: userId,
    category,
    amount: amt,
    description: desc,
    expense_date: expenseDate,
  });

  const updatedCat = await categoryService.getCategoryByName(userId, category);
  const budgetWarning = updatedCat
    ? buildBudgetWarning(
        category,
        Number(updatedCat.allocated_amount),
        Number(updatedCat.spent_amount)
      )
    : null;

  return {
    success: true,
    expense,
    category,
    amount: amt,
    description: desc,
    budgetWarning,
  };
};

// ─── Main handler ─────────────────────────────────────────────────────────────

// POST /api/chat   body: { userId, message }
export const chat = asyncHandler(async (req, res) => {
  const { userId, message } = req.body;

  if (!userId) return res.status(400).json({ error: 'userId is required.' });
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'message is required.' });
  }

  // Fetch user's actual categories from DB before calling AI
  const validCategories = await getUserCategories(userId);

  // Ask Groq to classify the message
  let intent;
  try {
    intent = await groqService.interpretMessage(message, validCategories);
  } catch (err) {
    return res.status(502).json({ error: err.message || 'The AI service is unavailable.' });
  }

  if (!intent || typeof intent !== 'object' || !intent.intent) {
    return res.status(422).json({ error: 'Sorry, I could not understand that request.' });
  }

  // ─── Intent dispatch ──────────────────────────────────────────────────────

  switch (intent.intent) {

    // ── Add expense(s) — handles both single and multiple via expenses[] array ─
    case 'add_expense': {
      const expenses = intent.expenses;

      if (!Array.isArray(expenses) || expenses.length === 0) {
        return res.status(422).json({ error: 'No expenses found in the request.' });
      }

      // Resolve all dates + times up-front into full DATETIME strings.
      const resolvedExpenses = expenses.map((e) => ({
        ...e,
        date: resolveExpenseDateTime(e.date, e.time),
      }));

      const user = await userService.findUserById(userId);
      if (!user) return res.status(404).json({ error: 'User not found.' });

      // Handle ambiguous expenses that need clarification
      const ambiguous = resolvedExpenses.filter(
        (e) => e.ambiguity === true && (e.amount === null || e.category === null)
      );
      if (ambiguous.length > 0 && resolvedExpenses.length === ambiguous.length) {
        // All expenses are ambiguous — ask for clarification
        return res.status(200).json({
          intent: 'add_expense',
          status: 'clarification_needed',
          message: ambiguous[0].possible_categories
            ? `I'm not sure which category this belongs to. Did you mean ${ambiguous[0].possible_categories.join(' or ')}?`
            : ambiguous[0].amount === null
            ? 'How much did you spend?'
            : 'Which category should this go under? Your categories are: ' + validCategories.join(', '),
          expenses: ambiguous,
        });
      }

      const added = [];
      const warnings = [];
      const errors = [];

      for (const exp of resolvedExpenses) {
        // Skip ambiguous items that are missing critical fields
        if (exp.ambiguity && (exp.amount === null || exp.category === null)) {
          errors.push({
            description: exp.description,
            reason: exp.amount === null ? 'Amount missing' : 'Category unclear',
            possible_categories: exp.possible_categories || null,
          });
          continue;
        }

        const result = await processSingleExpense(
          userId,
          exp.category,
          exp.amount,
          exp.description,
          validCategories,
          user,
          exp.date  // already resolved above
        );

        if (result.success) {
          added.push({
            category: result.category,
            amount: result.amount,
            description: result.description,
            expense: result.expense,
            confidence: exp.confidence,
            merchant: exp.merchant || null,
            payment_method: exp.payment_method || null,
          });
          if (result.budgetWarning) warnings.push(result.budgetWarning);
        } else {
          if (result.monthlyLimitExceeded && resolvedExpenses.length === 1) {
            return res.status(200).json({ ...result.data, expense_date: exp.date });
          }
          if (result.duplicate && resolvedExpenses.length === 1) {
            return res.status(200).json(result.data);
          }
          if (result.confirmationRequired && resolvedExpenses.length === 1) {
            // Embed resolved datetime so confirm controller can persist it
            const payload = { ...result.data };
            payload.expense = { ...payload.expense, date: exp.date, time: exp.time || null };
            return res.status(200).json(payload);
          }
          errors.push({
            attempted: { category: exp.category, amount: exp.amount, description: exp.description },
            reason: result.error || 'Could not process this expense.',
          });
        }
      }

      // Single expense — return in the format the frontend already understands
      if (resolvedExpenses.length === 1 && added.length === 1) {
        return res.status(201).json({
          intent: 'add_expense',
          success: true,
          category: added[0].category,
          amount: added[0].amount,
          description: added[0].description,
          expense: added[0].expense,
          budgetWarning: warnings[0] || null,
          meta: {
            confidence: added[0].confidence,
            merchant: added[0].merchant,
            payment_method: added[0].payment_method,
          },
        });
      }

      // Multiple expenses — return summary
      return res.status(added.length > 0 ? 201 : 422).json({
        intent: 'add_expense',
        success: added.length > 0,
        added,
        errors: errors.length > 0 ? errors : undefined,
        budgetWarnings: warnings.length > 0 ? warnings : undefined,
        summary: `Added ${added.length} of ${resolvedExpenses.length} expense(s).`,
      });
    }

    // ── Remaining total budget ────────────────────────────────────────────
    case 'remaining_budget': {
      const user = await userService.findUserById(userId);
      if (!user) return res.status(404).json({ error: 'User not found.' });
      const totalSpent = await expenseService.getTotalSpentByUser(userId);
      const remainingBudget = Number(user.monthly_budget) - totalSpent;
      return res.status(200).json({ intent: 'remaining_budget', remainingBudget });
    }

    // ── Remaining budget for one category ────────────────────────────────
    case 'remaining_category_budget': {
      const category = matchCategory(intent.category, validCategories);
      if (!category) {
        return res.status(422).json({
          error: `Unknown category "${intent.category}". Your categories are: ${validCategories.join(', ')}.`,
        });
      }
      const cat = await categoryService.getCategoryByName(userId, category);
      if (!cat) {
        return res.status(404).json({ error: `No "${category}" category found.` });
      }
      const remaining = Number(cat.allocated_amount) - Number(cat.spent_amount);
      return res.status(200).json({ intent: 'remaining_category_budget', category, remaining });
    }

    // ── Show all expenses ─────────────────────────────────────────────────
    case 'show_expenses': {
      const expenses = await expenseService.getExpensesByUser(userId);
      return res.status(200).json({ intent: 'show_expenses', expenses });
    }

    // ── Show expenses for one category ────────────────────────────────────
    case 'show_category_expenses': {
      const category = matchCategory(intent.category, validCategories);
      if (!category) {
        return res.status(422).json({
          error: `Unknown category "${intent.category}". Your categories are: ${validCategories.join(', ')}.`,
        });
      }
      const expenses = await expenseService.getExpensesByCategory(userId, category);
      return res.status(200).json({ intent: 'show_category_expenses', category, expenses });
    }

    // ── Show today's expenses ─────────────────────────────────────────────
    case 'show_today_expenses': {
      const expenses = await expenseService.getTodayExpensesByUser(userId);
      return res.status(200).json({ intent: 'show_today_expenses', expenses });
    }

    // ── Show this week's expenses ─────────────────────────────────────────
    case 'show_week_expenses': {
      const expenses = await expenseService.getWeekExpensesByUser(userId);
      return res.status(200).json({ intent: 'show_week_expenses', expenses });
    }

    // ── Show this month's expenses ────────────────────────────────────────
    case 'show_month_expenses': {
      const expenses = await expenseService.getMonthExpensesByUser(userId);
      return res.status(200).json({ intent: 'show_month_expenses', expenses });
    }

    // ── Full budget summary ───────────────────────────────────────────────
    case 'budget_summary': {
      const user = await userService.findUserById(userId);
      if (!user) return res.status(404).json({ error: 'User not found.' });
      const cats = await categoryService.getCategoriesByUser(userId);
      const totalSpent = await expenseService.getTotalSpentByUser(userId);
      const remaining = Number(user.monthly_budget) - totalSpent;

      const categories = (cats || []).map((c) => ({
        category: c.category_name,
        allocated: Number(c.allocated_amount),
        spent: Number(c.spent_amount),
        remaining: Number(c.allocated_amount) - Number(c.spent_amount),
      }));

      return res.status(200).json({
        intent: 'budget_summary',
        monthlyBudget: Number(user.monthly_budget),
        totalSpent,
        remainingBudget: remaining,
        categories,
      });
    }

    // ── Delete the most recent expense globally ───────────────────────────
    case 'delete_last_expense': {
      const last = await expenseService.getLatestExpense(userId);
      if (!last) return res.status(404).json({ error: 'You have no expenses to delete.' });
      await expenseService.deleteExpenseWithCategoryUpdate(last.id);
      return res.status(200).json({ intent: 'delete_last_expense', success: true, deleted: last });
    }

    // ── Delete the most recent expense in a specific category ─────────────
    case 'delete_last_category_expense': {
      const category = matchCategory(intent.category, validCategories);
      if (!category) {
        return res.status(422).json({
          error: `Unknown category "${intent.category}". Your categories are: ${validCategories.join(', ')}.`,
        });
      }
      const last = await expenseService.getLatestExpenseByCategory(userId, category);
      if (!last) {
        return res.status(404).json({ error: `No expenses found in "${category}".` });
      }
      await expenseService.deleteExpenseWithCategoryUpdate(last.id);
      return res.status(200).json({
        intent: 'delete_last_category_expense',
        success: true,
        deleted: last,
      });
    }

    // ── Conversational fallback ───────────────────────────────────────────
    case 'chat': {
      return res.status(200).json({
        intent: 'chat',
        message: intent.reply || "I'm here to help! Try saying something like 'I spent 500 on groceries' or 'How much budget is left?'",
      });
    }

    // ── Unknown / unsupported ─────────────────────────────────────────────
    case 'unknown':
      return res.status(200).json({
        intent: 'unknown',
        message: `I can help you track expenses, check your budget, or show spending history. Try: "I spent 500 on pizza" or "How much is left in Transport?"`,
      });

    default:
      return res.status(422).json({ error: `Unsupported intent: "${intent.intent}".` });
  }
});
