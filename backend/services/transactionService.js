// Unified transaction history — read-aggregation across all source tables.
// This is a READ-ONLY layer. Source tables are authoritative.
// Misc events without a dedicated table (budget transfers etc.) are stored
// in the `misc_transactions` table and merged here.
import pool from '../database/db.js';

// ─── Misc transactions table (budget transfers, manual adjustments, etc.) ─────

export const ensureMiscTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS misc_transactions (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      user_id       INT NOT NULL,
      type          VARCHAR(64) NOT NULL,
      amount        DECIMAL(12,2) NOT NULL DEFAULT 0,
      category      VARCHAR(255) DEFAULT NULL,
      description   VARCHAR(512) DEFAULT NULL,
      person        VARCHAR(255) DEFAULT NULL,
      investment_name VARCHAR(255) DEFAULT NULL,
      loan_id       INT DEFAULT NULL,
      investment_id INT DEFAULT NULL,
      currency      VARCHAR(8) DEFAULT 'PKR',
      notes         TEXT DEFAULT NULL,
      tx_date       DATE NOT NULL,
      tx_time       TIME DEFAULT NULL,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
};

// Record a misc transaction (budget transfers, savings transfers, etc.)
export const recordMiscTransaction = async ({
  userId, type, amount, category = null, description = null,
  person = null, investmentName = null, loanId = null, investmentId = null,
  notes = null, txDate = null, txTime = null,
}) => {
  await ensureMiscTable();
  const date = txDate || new Date().toISOString().split('T')[0];
  const [res] = await pool.execute(
    `INSERT INTO misc_transactions
       (user_id, type, amount, category, description, person, investment_name,
        loan_id, investment_id, notes, tx_date, tx_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, type, Number(amount), category, description, person,
     investmentName, loanId || null, investmentId || null, notes, date, txTime || null]
  );
  return res.insertId;
};

// ─── Main history aggregation ─────────────────────────────────────────────────

export const getTransactionHistory = async (userId) => {
  const id = Number(userId);

  // ── Expenses ────────────────────────────────────────────────────────────────
  const [expenses] = await pool.execute(
    `SELECT
       'expense'        AS type,
       e.id,
       e.amount,
       e.category,
       e.description,
       NULL             AS person,
       NULL             AS investment_name,
       NULL             AS loan_id,
       NULL             AS investment_id,
       e.expense_date   AS date,
       NULL             AS time,
       e.created_at
     FROM expenses e
     WHERE e.user_id = ?`,
    [id]
  );

  // ── Income ──────────────────────────────────────────────────────────────────
  const [income] = await pool.execute(
    `SELECT
       'income'         AS type,
       id,
       amount,
       source           AS category,
       description,
       NULL             AS person,
       NULL             AS investment_name,
       NULL             AS loan_id,
       NULL             AS investment_id,
       received_date    AS date,
       received_time    AS time,
       created_at
     FROM income
     WHERE user_id = ?`,
    [id]
  );

  // ── Loans given (original loan creation) ────────────────────────────────────
  const [loansGiven] = await pool.execute(
    `SELECT
       'loan_given'     AS type,
       id,
       original_amount  AS amount,
       'Loan Given'     AS category,
       description,
       person_name      AS person,
       NULL             AS investment_name,
       id               AS loan_id,
       NULL             AS investment_id,
       loan_date        AS date,
       loan_time        AS time,
       created_at
     FROM loans
     WHERE user_id = ? AND type = 'given'`,
    [id]
  );

  // ── Loans taken (original loan creation) ────────────────────────────────────
  const [loansTaken] = await pool.execute(
    `SELECT
       'loan_taken'     AS type,
       id,
       original_amount  AS amount,
       'Loan Taken'     AS category,
       description,
       person_name      AS person,
       NULL             AS investment_name,
       id               AS loan_id,
       NULL             AS investment_id,
       loan_date        AS date,
       loan_time        AS time,
       created_at
     FROM loans
     WHERE user_id = ? AND type = 'taken'`,
    [id]
  );

  // ── Repayments received & made (from loan_payments) ─────────────────────────
  let repaymentsReceived = [];
  let repaymentsMade = [];
  try {
    const [rr] = await pool.execute(
      `SELECT
         'repayment_received' AS type,
         lp.id,
         lp.amount,
         'Repayment Received' AS category,
         COALESCE(lp.notes, CONCAT('Repayment from ', l.person_name)) AS description,
         l.person_name        AS person,
         NULL                 AS investment_name,
         lp.loan_id,
         NULL                 AS investment_id,
         lp.payment_date      AS date,
         lp.payment_time      AS time,
         lp.created_at
       FROM loan_payments lp
       JOIN loans l ON lp.loan_id = l.id
       WHERE l.user_id = ? AND l.type = 'given'`,
      [id]
    );
    const [rm] = await pool.execute(
      `SELECT
         'repayment_made'   AS type,
         lp.id,
         lp.amount,
         'Repayment Made'   AS category,
         COALESCE(lp.notes, CONCAT('Repayment to ', l.person_name)) AS description,
         l.person_name      AS person,
         NULL               AS investment_name,
         lp.loan_id,
         NULL               AS investment_id,
         lp.payment_date    AS date,
         lp.payment_time    AS time,
         lp.created_at
       FROM loan_payments lp
       JOIN loans l ON lp.loan_id = l.id
       WHERE l.user_id = ? AND l.type = 'taken'`,
      [id]
    );
    repaymentsReceived = rr;
    repaymentsMade = rm;
  } catch { /* loan_payments not yet created */ }

  // ── Investment transactions ──────────────────────────────────────────────────
  let investmentTxs = [];
  try {
    const [rows] = await pool.execute(
      `SELECT
         it.type          AS raw_type,
         it.id,
         it.amount,
         i.type           AS category,
         i.name           AS description,
         NULL             AS person,
         i.name           AS investment_name,
         NULL             AS loan_id,
         it.investment_id,
         it.transaction_date AS date,
         it.transaction_time AS time,
         it.created_at
       FROM investment_transactions it
       JOIN investments i ON it.investment_id = i.id
       WHERE it.user_id = ?`,
      [id]
    );
    const typeMap = {
      purchase:     'investment_buy',
      sale:         'investment_sell',
      dividend:     'investment_dividend',
      interest:     'investment_interest',
      capital_gain: 'investment_gain',
      capital_loss: 'investment_loss',
    };
    investmentTxs = rows.map(r => ({
      ...r,
      type: typeMap[r.raw_type] || r.raw_type,
      raw_type: undefined,
    }));
  } catch { /* investment tables not yet created */ }

  // ── Misc transactions (budget transfers, savings transfers, etc.) ─────────────
  let miscTxs = [];
  try {
    await ensureMiscTable();
    const [rows] = await pool.execute(
      `SELECT
         type,
         id,
         amount,
         category,
         description,
         person,
         investment_name,
         loan_id,
         investment_id,
         tx_date     AS date,
         tx_time     AS time,
         created_at
       FROM misc_transactions
       WHERE user_id = ?`,
      [id]
    );
    miscTxs = rows;
  } catch { /* misc table not yet created */ }

  // ── Merge & normalise ────────────────────────────────────────────────────────
  const all = [
    ...expenses,
    ...income,
    ...loansGiven,
    ...loansTaken,
    ...repaymentsReceived,
    ...repaymentsMade,
    ...investmentTxs,
    ...miscTxs,
  ].map(row => ({
    id:              row.id,
    type:            row.type,
    amount:          Number(row.amount),
    category:        row.category || null,
    description:     row.description || null,
    person:          row.person || null,
    investment_name: row.investment_name || null,
    loan_id:         row.loan_id || null,
    investment_id:   row.investment_id || null,
    date:            row.date ? String(row.date).slice(0, 10) : null,
    time:            row.time || null,
    created_at:      row.created_at,
  }));

  // Sort: most recent date first, then by created_at for same-day entries
  all.sort((a, b) => {
    const da = a.date ? new Date(a.date) : new Date(a.created_at);
    const db = b.date ? new Date(b.date) : new Date(b.created_at);
    if (db - da !== 0) return db - da;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return all;
};
