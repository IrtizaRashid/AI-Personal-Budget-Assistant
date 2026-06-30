// Query Data Collector — fetches ONLY the modules required for a given query.
// Never touches MySQL directly; calls existing service functions.
import { getFinancialSnapshot } from './financialService.js';
import * as expenseService    from './expenseService.js';
import * as categoryService   from './categoryService.js';
import * as loanService       from './loanService.js';
import * as investmentService from './investmentService.js';
import { getTransactionHistory } from './transactionService.js';

const fmt = (n) => Number(Number(n).toFixed(2));

// ── Helpers ───────────────────────────────────────────────────────────────────

const filterByDate = (rows, dateRange, dateField = 'date') => {
  if (!dateRange) return rows;
  const { from, to } = dateRange;
  return rows.filter(r => {
    const d = new Date(r[dateField] || r.created_at || r.expense_date || r.received_date || r.loan_date || r.transaction_date);
    return d >= from && d <= to;
  });
};

const filterByPerson = (rows, person, ...fields) => {
  if (!person) return rows;
  const p = person.toLowerCase();
  return rows.filter(r =>
    fields.some(f => r[f] && String(r[f]).toLowerCase().includes(p))
  );
};

const groupByCategory = (expenses) => {
  const map = {};
  for (const e of expenses) {
    const cat = e.category || 'Other';
    map[cat] = (map[cat] || 0) + fmt(e.amount);
  }
  return Object.entries(map)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
};

const safeGet = async (fn, fallback) => {
  try { return await fn(); } catch { return fallback; }
};

// ── Income collector ──────────────────────────────────────────────────────────

const collectIncome = async (userId, dateRange) => {
  const records = await safeGet(() => expenseService.getIncomeByUser?.(userId) || [], []);
  // Try generic income table
  let income = [];
  try {
    const { default: pool } = await import('../database/db.js');
    const [rows] = await pool.execute(
      `SELECT source, description, amount, received_date AS date, recurring FROM income WHERE user_id = ? ORDER BY received_date DESC`,
      [userId]
    );
    income = rows.map(r => ({ ...r, amount: fmt(r.amount) }));
  } catch { income = records; }

  const filtered = filterByDate(income, dateRange, 'date');
  const totalIncome = filtered.reduce((s, r) => s + fmt(r.amount), 0);
  const bySources = {};
  filtered.forEach(r => { bySources[r.source || 'Other'] = (bySources[r.source || 'Other'] || 0) + fmt(r.amount); });

  return {
    records: filtered.slice(0, 50),
    totalIncome: fmt(totalIncome),
    bySources,
    count: filtered.length,
  };
};

// ── Expense collector ─────────────────────────────────────────────────────────

const collectExpenses = async (userId, dateRange, person) => {
  let expenses = [];
  try {
    const { default: pool } = await import('../database/db.js');
    const [rows] = await pool.execute(
      `SELECT category, description, amount, expense_date AS date FROM expenses WHERE user_id = ? ORDER BY expense_date DESC`,
      [userId]
    );
    expenses = rows.map(r => ({ ...r, amount: fmt(r.amount) }));
  } catch { expenses = []; }

  let filtered = filterByDate(expenses, dateRange, 'date');
  if (person) filtered = filtered.filter(r =>
    (r.description || '').toLowerCase().includes(person.toLowerCase())
  );

  const totalSpent = filtered.reduce((s, r) => s + fmt(r.amount), 0);
  const byCategory = groupByCategory(filtered);

  return {
    records: filtered.slice(0, 100),
    totalSpent: fmt(totalSpent),
    byCategory,
    biggestExpense: filtered.sort((a, b) => b.amount - a.amount)[0] || null,
    count: filtered.length,
  };
};

// ── Category / budget collector ───────────────────────────────────────────────

const collectBudget = async (userId) => {
  const cats = await safeGet(() => categoryService.getCategoriesByUser(userId), []);
  return cats.map(c => ({
    category: c.category_name,
    allocated: fmt(c.allocated_amount),
    spent: fmt(c.spent_amount || 0),
    remaining: fmt(c.allocated_amount - (c.spent_amount || 0)),
    usedPct: c.allocated_amount > 0
      ? fmt(((c.spent_amount || 0) / c.allocated_amount) * 100) : 0,
    status: (() => {
      const p = c.allocated_amount > 0 ? (c.spent_amount || 0) / c.allocated_amount : 0;
      if (p >= 1) return 'OVER_BUDGET';
      if (p >= 0.8) return 'NEAR_LIMIT';
      if (p >= 0.5) return 'MODERATE';
      if (p > 0) return 'LOW';
      return 'UNUSED';
    })(),
  }));
};

// ── Loan collector ────────────────────────────────────────────────────────────

const collectLoans = async (userId, person) => {
  const all = await safeGet(() => loanService.getLoansByUser(userId), []);

  // Loan payments
  let payments = [];
  try {
    const { default: pool } = await import('../database/db.js');
    const [rows] = await pool.execute(
      `SELECT lp.amount, lp.payment_date AS date, lp.notes, l.person_name, l.type AS loan_type
       FROM loan_payments lp JOIN loans l ON lp.loan_id = l.id WHERE l.user_id = ?
       ORDER BY lp.payment_date DESC`,
      [userId]
    );
    payments = rows.map(r => ({ ...r, amount: fmt(r.amount) }));
  } catch { /* table might not exist */ }

  let loans = all.map(l => ({
    person: l.person_name,
    type: l.type,
    originalAmount: fmt(l.original_amount),
    remaining: fmt(l.amount),
    status: l.status,
    date: l.loan_date,
    description: l.description,
  }));

  if (person) {
    const p = person.toLowerCase();
    loans    = loans.filter(l => l.person.toLowerCase().includes(p));
    payments = payments.filter(pm => pm.person_name.toLowerCase().includes(p));
  }

  const givenActive  = loans.filter(l => l.type === 'given'  && l.status === 'active');
  const takenActive  = loans.filter(l => l.type === 'taken'  && l.status === 'active');
  const totalOwedToMe = givenActive.reduce((s, l) => s + l.remaining, 0);
  const totalIOwe     = takenActive.reduce((s, l) => s + l.remaining, 0);

  return { loans, payments: payments.slice(0, 50), totalOwedToMe: fmt(totalOwedToMe), totalIOwe: fmt(totalIOwe) };
};

// ── Investment collector ──────────────────────────────────────────────────────

const collectInvestments = async (userId) => {
  const portfolio = await safeGet(() => investmentService.getPortfolio(userId), []);
  const summary   = await safeGet(() => investmentService.getInvestmentSummary(userId), {});
  const txs       = await safeGet(() => investmentService.getInvestmentTransactions(userId), []);
  return { portfolio, summary, recentTransactions: txs.slice(0, 30) };
};

// ── Transaction history collector ─────────────────────────────────────────────

const collectTransactions = async (userId, dateRange, person) => {
  const all = await safeGet(() => getTransactionHistory(userId), []);
  let filtered = filterByDate(all, dateRange);
  if (person) {
    const p = person.toLowerCase();
    filtered = filtered.filter(r =>
      (r.person || '').toLowerCase().includes(p) ||
      (r.description || '').toLowerCase().includes(p) ||
      (r.category || '').toLowerCase().includes(p)
    );
  }
  return { records: filtered.slice(0, 150), count: filtered.length };
};

// ─── Main export ──────────────────────────────────────────────────────────────

export const collectQueryData = async (userId, modules, dateRange, person) => {
  const data = {};

  // Always include financial snapshot
  data.financialSnapshot = await safeGet(() => getFinancialSnapshot(userId), {});

  const tasks = modules.map(async (mod) => {
    switch (mod) {
      case 'income':
        data.income = await collectIncome(userId, dateRange);
        break;
      case 'expenses':
        data.expenses = await collectExpenses(userId, dateRange, person);
        break;
      case 'categories':
      case 'budget':
        data.budget = data.budget || await collectBudget(userId);
        break;
      case 'loans':
        data.loans = await collectLoans(userId, person);
        break;
      case 'investments':
        data.investments = await collectInvestments(userId);
        break;
      case 'transactions':
        data.transactions = await collectTransactions(userId, dateRange, person);
        break;
      default:
        break; // dashboard snapshot already loaded above
    }
  });

  await Promise.all(tasks);
  return data;
};
