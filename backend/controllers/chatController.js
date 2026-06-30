// Chat controller — processes AI intents and executes them against the DB.
//
// Flow: React → here → local Ollama (classify only) → validate → DB → React
//
// The AI ONLY classifies intent. Every validation, calculation, and DB write
// happens here in our own code — the AI never touches the database.
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as groqService from '../services/groqService.js';
import * as expenseService from '../services/expenseService.js';
import * as userService from '../services/userService.js';
import * as categoryService from '../services/categoryService.js';
import * as setupService from '../services/setupService.js';
import * as loanService from '../services/loanService.js';
import * as investmentService from '../services/investmentService.js';
import { analyzeQuery } from '../services/queryAnalyzer.js';
import { collectQueryData } from '../services/queryDataCollector.js';
import { answerQuery } from '../services/aiQueryService.js';
import { buildBudgetWarning } from '../utils/budgetWarning.js';
import {
  exceedsMonthlyBudget,
  monthlyBudgetExceeded,
} from '../utils/monthlyBudget.js';
import { resolveExpenseDate, resolveExpenseDateTime } from '../utils/dateParser.js';
import { parseTime } from '../utils/timeParser.js';

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

const buildIncomeReallocation = async (userId, incomeAmount) => {
  const user = await userService.findUserById(userId);
  if (!user) throw new Error('User not found.');

  const categories = await categoryService.getCategoriesByUser(userId);
  if (!categories || categories.length === 0) {
    throw new Error('Please set up your budget categories before adding income.');
  }

  const currentIncome = Number(user.monthly_budget);
  const addedIncome = Number(incomeAmount);
  const newTotalIncome = currentIncome + addedIncome;

  let allocated = 0;
  const rows = categories.map((category, index) => {
    const currentAmount = Number(category.allocated_amount);
    const currentPercentage =
      currentIncome > 0 ? (currentAmount / currentIncome) * 100 : 0;
    const isLast = index === categories.length - 1;
    const calculatedAmount = isLast
      ? Number((newTotalIncome - allocated).toFixed(2))
      : Number(((newTotalIncome * currentPercentage) / 100).toFixed(2));
    allocated += calculatedAmount;

    return {
      category: category.category_name,
      currentPercentage: Number(currentPercentage.toFixed(2)),
      calculatedAmount,
      amount: calculatedAmount,
      percentage: Number(currentPercentage.toFixed(2)),
      spent: Number(category.spent_amount),
    };
  });

  return {
    currentIncome,
    addedIncome,
    newTotalIncome,
    rows,
  };
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
  const { userId, message, _skipSavingsCheck = false } = req.body;

  if (!userId) return res.status(400).json({ error: 'userId is required.' });
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'message is required.' });
  }

  // Fetch user's categories and active loans before calling AI
  const validCategories = await getUserCategories(userId);
  const activeLoans = (await loanService.getLoansByUser(userId)).filter(l => l.status === 'active');

  // Ask the local AI model to classify the message
  let intent;
  try {
    intent = await groqService.interpretMessage(message, validCategories, activeLoans);
  } catch (err) {
    return res.status(502).json({ error: err.message || 'The AI service is unavailable.' });
  }

  if (!intent || typeof intent !== 'object' || !intent.intent) {
    return res.status(422).json({ error: 'Sorry, I could not understand that request.' });
  }

  // ─── Intent dispatch ──────────────────────────────────────────────────────

  switch (intent.intent) {

    case 'income_received': {
      const amount = Number(intent.amount);

      if (!amount || amount <= 0) {
        return res.status(200).json({
          intent: 'income_received',
          status: 'amount_needed',
          message: 'How much income did you receive? Please include the amount.',
        });
      }

      try {
        // Normalise date & time from natural language → DB-ready values.
        // Rule: date given but no time → anchor to 00:00:00 (midnight, start of day).
        //       neither given → use current server time.
        const receivedDate = resolveExpenseDate(intent.date || null);
        const rawTime = intent.time ? parseTime(intent.time) : null;
        const receivedTime = rawTime ?? (intent.date ? '00:00:00' : new Date().toTimeString().split(' ')[0]);

        const reallocation = await buildIncomeReallocation(userId, amount);
        return res.status(200).json({
          intent: 'income_received',
          status: 'review_allocations',
          message: `Rs ${amount.toLocaleString()}${intent.source ? ` (${intent.source})` : ''} detected. Review your updated budget allocations below and save when ready.`,
          reallocation: {
            ...reallocation,
            source: intent.source || null,
            description: intent.description || null,
            recurring: intent.recurring || false,
            receivedDate,
            receivedTime,
          },
        });
      } catch (err) {
        return res.status(422).json({
          error: err.message || 'Could not prepare budget reallocation.',
        });
      }
    }

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

    // ── Shared expense — split bill, add expense + loans ─────────────────
    case 'shared_expense': {
      const { total, category, description, paidBy, splits = [], myShare } = intent;
      if (!total || Number(total) <= 0) {
        return res.status(200).json({ intent: 'shared_expense', status: 'missing_amount', message: 'How much was the total bill?' });
      }

      const totalAmt = Number(total);
      const iAmPayer = !paidBy || ['me', 'i', 'myself'].includes(String(paidBy).toLowerCase());

      // AI didn't know the split — ask the user to choose one
      if (intent.status === 'split_needed' || !splits || splits.length === 0) {
        return res.status(200).json({
          intent: 'shared_expense',
          status: 'split_needed',
          total: totalAmt,
          category: category || null,
          description: description || null,
          paidBy: iAmPayer ? 'me' : (paidBy || null),
          people: Array.isArray(intent.people) ? intent.people : [],
        });
      }

      const results = { intent: 'shared_expense', success: true, expense: null, loans: [], myShare: Number(myShare) || 0 };

      if (iAmPayer) {
        // Add full expense to budget
        const user = await userService.findUserById(userId);
        if (user) {
          const matchedCat = matchCategory(category, validCategories);
          if (matchedCat) {
            try {
              results.expense = await expenseService.addExpenseWithCategoryUpdate({
                user_id: userId, category: matchedCat,
                amount: totalAmt, description: description || matchedCat,
              });
            } catch { /* over budget — still record loans */ }
          }
        }
        // Loan given for each person's share
        for (const split of splits) {
          if (split.person && Number(split.amount) > 0) {
            const loan = await loanService.addLoan({
              userId, type: 'given', personName: split.person,
              amount: Number(split.amount), description: description || category || 'Shared expense',
            });
            results.loans.push(loan);
          }
        }
        const owedNames = splits.map(s => `${s.person} owes you Rs ${Number(s.amount).toLocaleString()}`).join(', ');
        results.message = `Rs ${totalAmt.toLocaleString()} expense added.${owedNames ? ' ' + owedNames + '.' : ''}`;
      } else {
        // Someone else paid — I owe them my share
        const oweAmt = Number(myShare) || 0;
        if (oweAmt > 0) {
          const loan = await loanService.addLoan({
            userId, type: 'taken', personName: paidBy,
            amount: oweAmt, description: description || category || 'Shared expense',
          });
          results.loans.push(loan);
        }
        results.message = `You owe ${paidBy} Rs ${oweAmt.toLocaleString()} for ${description || 'shared expense'}.`;
      }

      return res.status(200).json(results);
    }

    // ── Loan given (I lent money) ─────────────────────────────────────────
    case 'loan_given': {
      if (!intent.person || !intent.amount || Number(intent.amount) <= 0) {
        return res.status(200).json({ intent: 'loan_given', status: 'missing_info', message: 'Who did you lend to and how much?' });
      }
      const loanDate = resolveExpenseDate(intent.date || null);
      const loanTime = intent.time ? (parseTime(intent.time) ?? '00:00:00') : (intent.date ? '00:00:00' : null);
      const loan = await loanService.addLoan({
        userId, type: 'given', personName: intent.person,
        amount: Number(intent.amount), description: intent.description || null,
        loanDate, loanTime,
      });
      return res.status(201).json({
        intent: 'loan_given', success: true, loan,
        message: `Loan recorded — ${intent.person} owes you Rs ${Number(intent.amount).toLocaleString()}.`,
      });
    }

    // ── Loan taken (I borrowed money) ─────────────────────────────────────
    case 'loan_taken': {
      if (!intent.person || !intent.amount || Number(intent.amount) <= 0) {
        return res.status(200).json({ intent: 'loan_taken', status: 'missing_info', message: 'Who did you borrow from and how much?' });
      }
      const loanDate = resolveExpenseDate(intent.date || null);
      const loanTime = intent.time ? (parseTime(intent.time) ?? '00:00:00') : (intent.date ? '00:00:00' : null);
      const loan = await loanService.addLoan({
        userId, type: 'taken', personName: intent.person,
        amount: Number(intent.amount), description: intent.description || null,
        loanDate, loanTime,
      });
      return res.status(201).json({
        intent: 'loan_taken', success: true, loan,
        message: `Loan recorded — you owe ${intent.person} Rs ${Number(intent.amount).toLocaleString()}.`,
      });
    }

    // ── Loan repaid ───────────────────────────────────────────────────────
    case 'loan_repaid': {
      const dir = String(intent.direction || 'received').toLowerCase();
      const allLoans = await loanService.getLoansByUser(userId);
      const activeLoans = allLoans.filter(l => l.status === 'active');
      const paymentDate = resolveExpenseDate(intent.date || null);
      const paymentTime = intent.time ? (parseTime(intent.time) ?? null) : null;

      const REPAYMENT_PHRASES = [
        'returned', 'paid back', 'paid me back', 'paid the loan back', 'settled',
        'cleared', 'repaid', 'gave me back', 'returned my money', 'cleared the loan',
        'cleared what they owed', 'finished paying', 'completed the repayment',
        'paid everything back', 'gave my money back', 'squared up', 'cleared their debt',
      ];
      const msgLower = String(message).toLowerCase();
      const isRepaymentMessage = REPAYMENT_PHRASES.some(p => msgLower.includes(p));

      // ── Helper: process a single person's repayment ───────────────────
      const processOne = async (personName, amount, full) => {
        const pLower = String(personName).toLowerCase().trim();
        let loanType = dir === 'received' ? 'given' : 'taken';

        // Find matching active loan
        let matches = activeLoans.filter(
          l => l.type === loanType && l.person_name.toLowerCase().trim() === pLower
        );
        // Direction fallback
        if (matches.length === 0) {
          const fallbackType = loanType === 'given' ? 'taken' : 'given';
          const fallbacks = activeLoans.filter(
            l => l.type === fallbackType && l.person_name.toLowerCase().trim() === pLower
          );
          if (fallbacks.length > 0) {
            matches = fallbacks;
            loanType = fallbackType;
          }
        }

        if (matches.length === 0) {
          return { person: personName, success: false, reason: 'no_loan',
            message: `No active loan found for ${personName}.` };
        }

        // Multiple active loans for same person — ambiguous
        if (matches.length > 1 && !amount) {
          return { person: personName, success: false, reason: 'ambiguous',
            message: `${personName} has ${matches.length} active loans (Rs ${matches.map(l => Number(l.amount).toLocaleString()).join(', ')}). Please specify the amount.` };
        }

        const match = matches[0];
        const remaining = Number(match.amount);

        // Determine repayment amount
        const repayAmt = amount ? Number(amount) : remaining; // auto-settle if no amount

        let result;
        try {
          result = await loanService.repayLoan(match.id, repayAmt, { paymentDate, paymentTime });
        } catch (err) {
          return { person: personName, success: false, reason: 'error', message: err.message };
        }

        const effectiveDir = loanType === 'given' ? 'received' : 'sent';
        const msg = result.fullyPaid
          ? (effectiveDir === 'received'
              ? `${match.person_name} paid you back in full (Rs ${repayAmt.toLocaleString()}). Loan settled. ✓`
              : `You fully repaid ${match.person_name} (Rs ${repayAmt.toLocaleString()}). Loan settled. ✓`)
          : (effectiveDir === 'received'
              ? `${match.person_name} paid Rs ${repayAmt.toLocaleString()}. Remaining: Rs ${result.remaining.toLocaleString()}.`
              : `You paid ${match.person_name} Rs ${repayAmt.toLocaleString()}. Still owe: Rs ${result.remaining.toLocaleString()}.`);

        return {
          person: match.person_name, success: true,
          fullyPaid: result.fullyPaid, amountReceived: repayAmt,
          remaining: result.remaining, newBudget: result.newBudget,
          loanStatus: result.fullyPaid ? 'paid' : 'active', message: msg,
        };
      };

      // ── "everyone paid me back" ───────────────────────────────────────
      if (intent.people === 'everyone') {
        const eligibleType = dir === 'received' ? 'given' : 'taken';
        const targets = activeLoans.filter(l => l.type === eligibleType);
        if (targets.length === 0) {
          return res.status(200).json({ intent: 'loan_repaid', success: false,
            message: 'No active loans found to settle.' });
        }
        const results = await Promise.all(
          targets.map(l => processOne(l.person_name, null, true))
        );
        const succeeded = results.filter(r => r.success);
        const failed    = results.filter(r => !r.success);
        const lines = [
          ...succeeded.map(r => r.message),
          ...failed.map(r => `⚠️ ${r.message}`),
        ].join('\n');
        return res.status(200).json({
          intent: 'loan_repaid', success: succeeded.length > 0,
          results, message: lines,
        });
      }

      // ── Multi-person array ────────────────────────────────────────────
      if (Array.isArray(intent.people) && intent.people.length > 0) {
        const results = await Promise.all(
          intent.people.map(p => processOne(
            p.person,
            p.amount ?? null,
            p.full ?? false,
          ))
        );
        const succeeded = results.filter(r => r.success);
        const failed    = results.filter(r => !r.success);
        const lines = [
          ...succeeded.map(r => r.message),
          ...failed.map(r => `⚠️ ${r.message}`),
        ].join('\n');
        return res.status(200).json({
          intent: 'loan_repaid', success: succeeded.length > 0,
          results, message: lines,
        });
      }

      // ── Single person ─────────────────────────────────────────────────
      if (!intent.person) {
        return res.status(200).json({ intent: 'loan_repaid', success: false,
          message: 'Who repaid the loan? Please specify the person\'s name.' });
      }

      const singleResult = await processOne(
        intent.person,
        intent.amount ?? null,
        intent.full ?? false,
      );

      // If no active loan and message doesn't look like repayment → create new loan
      if (!singleResult.success && singleResult.reason === 'no_loan' && !isRepaymentMessage && intent.amount) {
        const newLoanType = dir === 'received' ? 'given' : 'taken';
        const loanDate = resolveExpenseDate(intent.date || null);
        const loanTime = intent.time ? (parseTime(intent.time) ?? null) : null;
        const loan = await loanService.addLoan({
          userId, type: newLoanType, personName: intent.person,
          amount: Number(intent.amount), description: intent.description || null,
          loanDate, loanTime,
        });
        const label = newLoanType === 'given'
          ? `Loan recorded — ${intent.person} owes you Rs ${Number(intent.amount).toLocaleString()}.`
          : `Loan recorded — you owe ${intent.person} Rs ${Number(intent.amount).toLocaleString()}.`;
        return res.status(201).json({
          intent: newLoanType === 'given' ? 'loan_given' : 'loan_taken',
          success: true, loan, message: label,
        });
      }

      return res.status(200).json({ intent: 'loan_repaid', ...singleResult });
    }

    // ── Show loans ────────────────────────────────────────────────────────
    case 'show_loans': {
      const allLoans = await loanService.getLoansByUser(userId);
      const filter = String(intent.filter || 'all').toLowerCase();
      const filtered = allLoans.filter((l) => {
        if (filter === 'given') return l.type === 'given';
        if (filter === 'taken') return l.type === 'taken';
        if (filter === 'active') return l.status === 'active';
        if (filter === 'paid') return l.status === 'paid';
        return true;
      });
      return res.status(200).json({ intent: 'show_loans', loans: filtered });
    }

    // ── Investment buy ────────────────────────────────────────────────────
    case 'investment_buy': {
      const invName = intent.name || intent.description || 'Unknown';
      const invAmt  = Number(intent.amount);
      if (!invAmt || invAmt <= 0) {
        return res.status(200).json({ intent: 'investment_buy', success: false, message: 'Please specify the investment amount.' });
      }
      const purchaseDate = resolveExpenseDate(intent.date || null);
      const purchaseTime = intent.time ? (parseTime(intent.time) ?? null) : null;

      let buyResult;
      try {
        buyResult = await investmentService.buyInvestment({
          userId, name: invName, type: intent.type || null,
          amount: invAmt, quantity: intent.quantity ? Number(intent.quantity) : null,
          purchaseDate, purchaseTime, notes: intent.notes || null,
          skipSavingsCheck: !!_skipSavingsCheck,
        });
      } catch (err) {
        if (err.code === 'INSUFFICIENT_SAVINGS' || err.code === 'NO_SAVINGS_CATEGORY') {
          // Return a structured response so the frontend can show transfer options
          return res.status(200).json({
            intent: 'investment_buy',
            success: false,
            reason: err.code === 'INSUFFICIENT_SAVINGS' ? 'insufficient_savings' : 'no_savings_category',
            available: err.available ?? 0,
            required: invAmt,
            savingsCategory: err.savingsCategory ?? 'Savings',
            shortfall: invAmt - (err.available ?? 0),
            // Preserve the pending investment so the frontend can retry after transfer
            pending: { name: invName, type: intent.type || null, amount: invAmt,
                       quantity: intent.quantity ? Number(intent.quantity) : null,
                       date: intent.date || null, time: intent.time || null },
            message: err.code === 'INSUFFICIENT_SAVINGS'
              ? `You only have Rs ${(err.available ?? 0).toLocaleString()} available in Savings, but this investment requires Rs ${invAmt.toLocaleString()}.`
              : 'No Savings category found. Please add a Savings allocation to your budget first.',
          });
        }
        throw err;
      }

      const { investment, newBudget, savingsAfter } = buyResult;
      return res.status(201).json({
        intent: 'investment_buy', success: true, investment, newBudget, savingsAfter,
        message: `Investment recorded — Rs ${invAmt.toLocaleString()} in ${invName} (${investment.type}). Deducted from Savings. Available balance updated.`,
      });
    }

    // ── Investment sell ───────────────────────────────────────────────────
    case 'investment_sell': {
      const sellName = intent.name || intent.description;
      const sellAmt  = Number(intent.amount);
      if (!sellName || !sellAmt || sellAmt <= 0) {
        return res.status(200).json({ intent: 'investment_sell', success: false, message: 'Please specify what you sold and for how much.' });
      }
      // Find active investment by name
      const activeInv = await investmentService.findActiveByName(userId, sellName);
      if (!activeInv) {
        return res.status(200).json({ intent: 'investment_sell', success: false, message: `No active investment named "${sellName}" found.` });
      }
      const saleDate = resolveExpenseDate(intent.date || null);
      const saleTime = intent.time ? (parseTime(intent.time) ?? null) : null;
      const sellResult = await investmentService.sellInvestment({
        investmentId: activeInv.id, userId, saleAmount: sellAmt,
        saleQuantity: intent.quantity ? Number(intent.quantity) : null,
        saleDate, saleTime, notes: intent.notes || null,
      });
      const plLabel = sellResult.profitLoss >= 0
        ? `Profit: Rs ${sellResult.profitLoss.toLocaleString()}`
        : `Loss: Rs ${Math.abs(sellResult.profitLoss).toLocaleString()}`;
      const savingsNote = sellResult.savingsAfter !== null
        ? ` Savings balance: Rs ${Number(sellResult.savingsAfter).toLocaleString()}.` : '';
      return res.status(200).json({
        intent: 'investment_sell', success: true, ...sellResult,
        message: `${sellName} sold for Rs ${sellAmt.toLocaleString()}. ${plLabel}. Sale proceeds returned to Savings.${savingsNote}`,
      });
    }

    // ── Investment dividend / interest / profit ────────────────────────────
    case 'investment_dividend': {
      const divAmt = Number(intent.amount);
      if (!divAmt || divAmt <= 0) {
        return res.status(200).json({ intent: 'investment_dividend', success: false, message: 'Please specify the dividend amount.' });
      }
      const divDate = resolveExpenseDate(intent.date || null);
      const divTime = intent.time ? (parseTime(intent.time) ?? null) : null;
      const divResult = await investmentService.addDividend({
        userId, investmentName: intent.name || null, amount: divAmt,
        type: intent.dividend_type || 'dividend',
        txDate: divDate, txTime: divTime, notes: intent.notes || null,
      });
      const typeLabel = { dividend: 'Dividend', interest: 'Interest', capital_gain: 'Capital gain', capital_loss: 'Capital loss' }[intent.dividend_type] || 'Dividend';
      return res.status(200).json({
        intent: 'investment_dividend', success: true, ...divResult,
        message: `${typeLabel} of Rs ${divAmt.toLocaleString()} recorded. Available balance updated.`,
      });
    }

    // ── Show investments ──────────────────────────────────────────────────
    case 'show_investments': {
      const portfolio = await investmentService.getPortfolio(userId);
      const summary   = await investmentService.getInvestmentSummary(userId);
      const filter    = String(intent.filter || 'all').toLowerCase();
      const filtered  = portfolio.filter(inv => {
        if (filter === 'active') return inv.status === 'active';
        if (filter === 'sold')   return inv.status === 'sold';
        if (filter.startsWith('type:')) return inv.type.toLowerCase() === filter.slice(5);
        return true;
      });
      return res.status(200).json({ intent: 'show_investments', investments: filtered, summary });
    }

    // ── Universal AI Query — complex analytical questions ─────────────────
    case 'ai_query': {
      // Use the original user message (not the intent's "query" field) so
      // we get the exact phrasing the user typed.
      const rawQuery = String(intent.query || message);
      const { modules, dateRange, person } = analyzeQuery(rawQuery);
      const structuredData = await collectQueryData(userId, modules, dateRange, person);
      const answer = await answerQuery(rawQuery, structuredData, dateRange, person);
      return res.status(200).json({
        intent: 'ai_query',
        success: true,
        answer,
        meta: { modules, dateRange: dateRange?.label || null, person: person || null },
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
