// Data-access layer for the `expenses` table.
import pool from '../database/db.js';

// INSERT a new expense, then return the full saved row.
// expense_date is optional — the column defaults to NOW().
export const createExpense = async ({
  user_id,
  category,
  amount,
  description = null,
  expense_date,
}) => {
  let result;

  if (expense_date) {
    [result] = await pool.execute(
      `INSERT INTO expenses (user_id, category, amount, description, expense_date)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, category, amount, description, expense_date]
    );
  } else {
    [result] = await pool.execute(
      `INSERT INTO expenses (user_id, category, amount, description)
       VALUES (?, ?, ?, ?)`,
      [user_id, category, amount, description]
    );
  }

  return findExpenseById(result.insertId);
};

export const findExpenseById = async (id) => {
  const [rows] = await pool.execute(
    `SELECT id, user_id, category, amount, description, expense_date
       FROM expenses WHERE id = ?`,
    [id]
  );
  return rows[0];
};

// SELECT all expenses for a user, latest first.
export const getExpensesByUser = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT id, user_id, category, amount, description, expense_date
       FROM expenses
      WHERE user_id = ?
      ORDER BY expense_date DESC, id DESC`,
    [userId]
  );
  return rows;
};

// Insert an expense AND increment the matching category's spent_amount,
// in a single transaction so the two stay consistent (both succeed or
// both roll back). Used by the AI chat add_expense intent.
export const addExpenseWithCategoryUpdate = async ({
  user_id,
  category,
  amount,
  description = null,
  expense_date = null,
}) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Insert the expense. Use the provided date or default to NOW().
    const [ins] = await connection.execute(
      expense_date
        ? `INSERT INTO expenses (user_id, category, amount, description, expense_date)
           VALUES (?, ?, ?, ?, ?)`
        : `INSERT INTO expenses (user_id, category, amount, description)
           VALUES (?, ?, ?, ?)`,
      expense_date
        ? [user_id, category, amount, description, expense_date]
        : [user_id, category, amount, description]
    );

    // 2. Add the amount to that category's running spent_amount.
    await connection.execute(
      `UPDATE budget_categories
          SET spent_amount = spent_amount + ?
        WHERE user_id = ? AND category_name = ?`,
      [amount, user_id, category]
    );

    await connection.commit();

    // Return the saved expense row.
    const [rows] = await connection.execute(
      `SELECT id, user_id, category, amount, description, expense_date
         FROM expenses WHERE id = ?`,
      [ins.insertId]
    );
    return rows[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Delete an expense AND subtract its amount from the matching category's
// spent_amount, in one transaction. Returns the deleted expense, or null
// if no expense with that id exists. Used by DELETE and delete_last_expense.
export const deleteExpenseWithCategoryUpdate = async (expenseId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Look up the expense first so we know which category/amount to adjust.
    const [rows] = await connection.execute(
      'SELECT id, user_id, category, amount, description, expense_date FROM expenses WHERE id = ?',
      [expenseId]
    );
    const expense = rows[0];
    if (!expense) {
      await connection.rollback();
      return null; // invalid id
    }

    // Remove the expense.
    await connection.execute('DELETE FROM expenses WHERE id = ?', [expenseId]);

    // Subtract from spent_amount. GREATEST(...,0) guards against going negative.
    await connection.execute(
      `UPDATE budget_categories
          SET spent_amount = GREATEST(spent_amount - ?, 0)
        WHERE user_id = ? AND category_name = ?`,
      [expense.amount, expense.user_id, expense.category]
    );

    await connection.commit();
    return expense;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Transfer budget allocation from one category to another, then record the
// expense — all in a single transaction. Used when a category has run out of
// budget and the user chooses to cover the expense from another category.
//
// Steps: validate source funds -> move allocation -> insert expense -> bump
// spent on the target. Throws an error with code 'INSUFFICIENT_FUNDS' if the
// source can't cover the amount.
export const transferFundsAndAddExpense = async ({
  user_id,
  toCategory,
  fromCategory,
  amount,
  description = null,
  expense_date = null,
}) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Lock + read both categories.
    const [srcRows] = await connection.execute(
      `SELECT allocated_amount, spent_amount
         FROM budget_categories
        WHERE user_id = ? AND category_name = ?
        FOR UPDATE`,
      [user_id, fromCategory]
    );
    const src = srcRows[0];
    if (!src) {
      const e = new Error(`Source category "${fromCategory}" not found.`);
      e.code = 'INSUFFICIENT_FUNDS';
      throw e;
    }

    const [tgtRows] = await connection.execute(
      `SELECT allocated_amount, spent_amount
         FROM budget_categories
        WHERE user_id = ? AND category_name = ?
        FOR UPDATE`,
      [user_id, toCategory]
    );
    const tgt = tgtRows[0];
    if (!tgt) {
      const e = new Error(`Target category "${toCategory}" not found.`);
      e.code = 'INSUFFICIENT_FUNDS';
      throw e;
    }

    // 2. Calculate how much the target is short (only transfer the shortage).
    const tgtRemaining = Number(tgt.allocated_amount) - Number(tgt.spent_amount);
    const shortage = amount - tgtRemaining;

    // 3. Validate the source has enough to cover the shortage.
    const srcRemaining = Number(src.allocated_amount) - Number(src.spent_amount);
    if (srcRemaining < shortage) {
      const e = new Error(
        `${fromCategory} only has ${srcRemaining} available; cannot transfer ${shortage}.`
      );
      e.code = 'INSUFFICIENT_FUNDS';
      throw e;
    }

    // 4. Move only the shortage amount from source -> target.
    await connection.execute(
      `UPDATE budget_categories SET allocated_amount = allocated_amount - ?
        WHERE user_id = ? AND category_name = ?`,
      [shortage, user_id, fromCategory]
    );
    await connection.execute(
      `UPDATE budget_categories SET allocated_amount = allocated_amount + ?
        WHERE user_id = ? AND category_name = ?`,
      [shortage, user_id, toCategory]
    );

    // 5. Insert the expense against the target category (full amount).
    const [ins] = await connection.execute(
      expense_date
        ? `INSERT INTO expenses (user_id, category, amount, description, expense_date)
           VALUES (?, ?, ?, ?, ?)`
        : `INSERT INTO expenses (user_id, category, amount, description)
           VALUES (?, ?, ?, ?)`,
      expense_date
        ? [user_id, toCategory, amount, description, expense_date]
        : [user_id, toCategory, amount, description]
    );

    // 6. Bump the target category's spent_amount by the full amount.
    await connection.execute(
      `UPDATE budget_categories SET spent_amount = spent_amount + ?
        WHERE user_id = ? AND category_name = ?`,
      [amount, user_id, toCategory]
    );

    await connection.commit();

    const [rows] = await connection.execute(
      `SELECT id, user_id, category, amount, description, expense_date
         FROM expenses WHERE id = ?`,
      [ins.insertId]
    );
    return rows[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// SELECT expenses for a user filtered by category, latest first.
export const getExpensesByCategory = async (userId, category) => {
  const [rows] = await pool.execute(
    `SELECT id, user_id, category, amount, description, expense_date
       FROM expenses
      WHERE user_id = ? AND category = ?
      ORDER BY expense_date DESC, id DESC`,
    [userId, category]
  );
  return rows;
};

// SELECT today's expenses for a user, latest first.
export const getTodayExpensesByUser = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT id, user_id, category, amount, description, expense_date
       FROM expenses
      WHERE user_id = ? AND DATE(expense_date) = CURDATE()
      ORDER BY expense_date DESC, id DESC`,
    [userId]
  );
  return rows;
};

// Find a likely DUPLICATE expense: same category + amount + description,
// recorded within the last 10 minutes. Returns the match or undefined.
// Used to warn the user before inserting a probable accidental re-entry.
export const findRecentDuplicate = async (userId, category, amount, description) => {
  const [rows] = await pool.execute(
    `SELECT id, category, amount, description, expense_date
       FROM expenses
      WHERE user_id = ?
        AND category = ?
        AND amount = ?
        AND description = ?
        AND expense_date >= (NOW() - INTERVAL 10 MINUTE)
      ORDER BY expense_date DESC
      LIMIT 1`,
    [userId, category, amount, description]
  );
  return rows[0];
};

// SELECT the single most recent expense for a user (or undefined).
export const getLatestExpense = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT id, user_id, category, amount, description, expense_date
       FROM expenses
      WHERE user_id = ?
      ORDER BY expense_date DESC, id DESC
      LIMIT 1`,
    [userId]
  );
  return rows[0];
};

// SUM of all expense amounts for a user (returns a Number).
// COALESCE guarantees 0 (not NULL) when the user has no expenses.
export const getTotalSpentByUser = async (userId) => {
  const [rows] = await pool.execute(
    'SELECT COALESCE(SUM(amount), 0) AS totalSpent FROM expenses WHERE user_id = ?',
    [userId]
  );
  // mysql2 returns DECIMAL/SUM as a string — convert to a real number.
  return Number(rows[0].totalSpent);
};

// Start a new month: delete ALL of a user's expenses and reset every
// category's spent_amount to 0 — in one transaction. Keeps the user and their
// category allocations (budget) intact.
export const resetMonthForUser = async (userId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM expenses WHERE user_id = ?', [userId]);
    await connection.execute(
      'UPDATE budget_categories SET spent_amount = 0 WHERE user_id = ?',
      [userId]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// COUNT of expense records for a user (returns a Number).
export const getExpenseCountByUser = async (userId) => {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS count FROM expenses WHERE user_id = ?',
    [userId]
  );
  return Number(rows[0].count);
};

// SELECT expenses from the last 7 days for a user, latest first.
export const getWeekExpensesByUser = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT id, user_id, category, amount, description, expense_date
       FROM expenses
      WHERE user_id = ?
        AND expense_date >= (NOW() - INTERVAL 7 DAY)
      ORDER BY expense_date DESC, id DESC`,
    [userId]
  );
  return rows;
};

// SELECT expenses from the current calendar month for a user, latest first.
export const getMonthExpensesByUser = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT id, user_id, category, amount, description, expense_date
       FROM expenses
      WHERE user_id = ?
        AND MONTH(expense_date) = MONTH(NOW())
        AND YEAR(expense_date)  = YEAR(NOW())
      ORDER BY expense_date DESC, id DESC`,
    [userId]
  );
  return rows;
};

// SELECT the most recent expense for a user in a specific category.
export const getLatestExpenseByCategory = async (userId, category) => {
  const [rows] = await pool.execute(
    `SELECT id, user_id, category, amount, description, expense_date
       FROM expenses
      WHERE user_id = ? AND category = ?
      ORDER BY expense_date DESC, id DESC
      LIMIT 1`,
    [userId, category]
  );
  return rows[0];
};
