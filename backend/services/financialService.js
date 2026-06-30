// Centralized financial snapshot — single source of truth.
// Called after every mutation so all derived values stay in sync.
import pool from '../database/db.js';

export const getFinancialSnapshot = async (userId) => {
  // ── Income ──────────────────────────────────────────────────────────────────
  const [[incomeRow]] = await pool.execute(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM income WHERE user_id = ?`,
    [userId]
  );

  // ── Expenses ─────────────────────────────────────────────────────────────────
  const [[expenseRow]] = await pool.execute(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ?`,
    [userId]
  );

  // ── Monthly budget (user-set base) ──────────────────────────────────────────
  const [[userRow]] = await pool.execute(
    `SELECT monthly_budget FROM users WHERE id = ?`,
    [userId]
  );
  const monthlyBudget = Number(userRow?.monthly_budget ?? 0);

  // ── Loans ────────────────────────────────────────────────────────────────────
  const [[loanRow]] = await pool.execute(
    `SELECT
       COALESCE(SUM(CASE WHEN type='given'  AND status='active' THEN amount ELSE 0 END), 0) AS owed_to_me,
       COALESCE(SUM(CASE WHEN type='taken'  AND status='active' THEN amount ELSE 0 END), 0) AS i_owe,
       COALESCE(SUM(CASE WHEN type='given'  AND status='active' THEN original_amount ELSE 0 END), 0) AS total_lent,
       COALESCE(SUM(CASE WHEN type='taken'  AND status='active' THEN original_amount ELSE 0 END), 0) AS total_borrowed,
       SUM(CASE WHEN type='given'  AND status='active' THEN 1 ELSE 0 END) AS given_count,
       SUM(CASE WHEN type='taken'  AND status='active' THEN 1 ELSE 0 END) AS taken_count
     FROM loans WHERE user_id = ?`,
    [userId]
  );

  // ── Loan repayments (payments table may not exist yet) ───────────────────────
  let repaymentsReceived = 0;
  let repaymentsMade = 0;
  try {
    const [[repRow]] = await pool.execute(
      `SELECT
         COALESCE(SUM(CASE WHEN l.type='given'  THEN lp.amount ELSE 0 END), 0) AS received,
         COALESCE(SUM(CASE WHEN l.type='taken'  THEN lp.amount ELSE 0 END), 0) AS made
       FROM loan_payments lp
       JOIN loans l ON lp.loan_id = l.id
       WHERE l.user_id = ?`,
      [userId]
    );
    repaymentsReceived = Number(repRow.received);
    repaymentsMade = Number(repRow.made);
  } catch { /* table not yet created — safe to ignore */ }

  // ── Investments ──────────────────────────────────────────────────────────────
  let totalInvested = 0;
  let portfolioValue = 0;
  let investmentPL = 0;
  let activeInvestments = 0;
  try {
    const [[invRow]] = await pool.execute(
      `SELECT COALESCE(SUM(invested_amount),0) AS invested,
              COALESCE(SUM(current_value),0)   AS value,
              COUNT(*) AS cnt
       FROM investments WHERE user_id = ? AND status = 'active'`,
      [userId]
    );
    totalInvested = Number(invRow.invested);
    portfolioValue = Number(invRow.value);
    investmentPL = portfolioValue - totalInvested;
    activeInvestments = Number(invRow.cnt);
  } catch { /* table not yet created */ }

  const totalIncome    = Number(incomeRow.total);
  const totalExpenses  = Number(expenseRow.total);
  const owedToMe       = Number(loanRow.owed_to_me);
  const iOwe           = Number(loanRow.i_owe);

  // Available Balance = Budget − Expenses
  // (monthly_budget already incorporates saved income + loan repayments received)
  const availableBalance = monthlyBudget - totalExpenses;

  return {
    monthlyBudget,
    totalIncome,
    totalExpenses,
    totalSpent: totalExpenses,
    availableBalance,
    remainingBudget: availableBalance,
    owedToMe,
    iOwe,
    totalLent: Number(loanRow.total_lent),
    totalBorrowed: Number(loanRow.total_borrowed),
    repaymentsReceived,
    repaymentsMade,
    givenCount: Number(loanRow.given_count),
    takenCount: Number(loanRow.taken_count),
    // Investments
    totalInvested,
    portfolioValue,
    investmentPL,
    activeInvestments,
  };
};
