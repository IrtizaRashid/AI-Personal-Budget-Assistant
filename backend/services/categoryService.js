// Data-access layer for the `budget_categories` table.
import pool from '../database/db.js';
import { recordMiscTransaction } from './transactionService.js';

// Bulk-INSERT an array of categories in one query.
// `pool.query` (not execute) is used because it supports the
// nested-array bulk-insert form: VALUES ?  ->  [[...], [...]]
export const createCategories = async (categories) => {
  const values = categories.map((c) => [
    c.user_id,
    c.category_name,
    c.allocated_amount ?? 0,
    c.spent_amount ?? 0,
  ]);

  const [result] = await pool.query(
    `INSERT INTO budget_categories
       (user_id, category_name, allocated_amount, spent_amount)
     VALUES ?`,
    [values]
  );

  return result.affectedRows;
};

// SELECT a single category for a user by its name (or undefined).
export const getCategoryByName = async (userId, categoryName) => {
  const [rows] = await pool.execute(
    `SELECT id, user_id, category_name, allocated_amount, spent_amount
       FROM budget_categories
      WHERE user_id = ? AND category_name = ?
      LIMIT 1`,
    [userId, categoryName]
  );
  return rows[0];
};

// SELECT all categories for a user (raw stored values).
export const getCategoriesByUser = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT id, user_id, category_name, allocated_amount, spent_amount
       FROM budget_categories
      WHERE user_id = ?
      ORDER BY id ASC`,
    [userId]
  );
  return rows;
};

// ─── Savings helpers ──────────────────────────────────────────────────────────

// Find the Savings category for a user (case-insensitive).
export const getSavingsCategory = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT id, category_name, allocated_amount, spent_amount
       FROM budget_categories
      WHERE user_id = ? AND LOWER(category_name) LIKE '%saving%'
      ORDER BY id ASC LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

// Return remaining = allocated - spent for Savings.
export const getSavingsRemaining = async (userId) => {
  const cat = await getSavingsCategory(userId);
  if (!cat) return { remaining: 0, category: null };
  const remaining = Number(cat.allocated_amount) - Number(cat.spent_amount);
  return { remaining, category: cat };
};

// Deduct from Savings (investment purchase): spent_amount += amount.
// Returns { remaining, category } after the deduction.
export const deductFromSavings = async (userId, amount) => {
  const cat = await getSavingsCategory(userId);
  if (!cat) throw new Error('Savings category not found. Please set up a Savings budget category first.');
  const remaining = Number(cat.allocated_amount) - Number(cat.spent_amount);
  if (remaining < Number(amount)) {
    throw new Error(`Insufficient savings. Available: Rs ${remaining.toLocaleString()}, Required: Rs ${Number(amount).toLocaleString()}.`);
  }
  await pool.execute(
    `UPDATE budget_categories SET spent_amount = spent_amount + ? WHERE id = ?`,
    [Number(amount), cat.id]
  );
  return { remaining: remaining - Number(amount), category: cat };
};

// Credit to Savings (investment sale): spent_amount -= amount (clamped to 0).
export const creditToSavings = async (userId, amount) => {
  const cat = await getSavingsCategory(userId);
  if (!cat) return null;
  await pool.execute(
    `UPDATE budget_categories
        SET spent_amount = GREATEST(0, spent_amount - ?)
      WHERE id = ?`,
    [Number(amount), cat.id]
  );
  const [[updated]] = await pool.execute(
    `SELECT allocated_amount, spent_amount FROM budget_categories WHERE id = ?`, [cat.id]
  );
  return {
    remaining: Number(updated.allocated_amount) - Number(updated.spent_amount),
    category: { ...cat, ...updated },
  };
};

// Transfer allocated_amount from one category to Savings.
export const transferToSavings = async (userId, fromCategoryName, amount) => {
  const amt = Number(amount);
  if (amt <= 0) throw new Error('Transfer amount must be greater than zero.');

  // Source category
  const from = await getCategoryByName(userId, fromCategoryName);
  if (!from) throw new Error(`Category "${fromCategoryName}" not found.`);
  const fromRemaining = Number(from.allocated_amount) - Number(from.spent_amount);
  if (fromRemaining < amt) {
    throw new Error(`"${fromCategoryName}" only has Rs ${fromRemaining.toLocaleString()} available to transfer.`);
  }

  // Savings category
  const savings = await getSavingsCategory(userId);
  if (!savings) throw new Error('Savings category not found.');

  // Move allocated_amount: decrease source, increase savings
  await pool.execute(
    `UPDATE budget_categories SET allocated_amount = allocated_amount - ? WHERE id = ?`,
    [amt, from.id]
  );
  await pool.execute(
    `UPDATE budget_categories SET allocated_amount = allocated_amount + ? WHERE id = ?`,
    [amt, savings.id]
  );

  const [[updatedFrom]]    = await pool.execute(`SELECT * FROM budget_categories WHERE id = ?`, [from.id]);
  const [[updatedSavings]] = await pool.execute(`SELECT * FROM budget_categories WHERE id = ?`, [savings.id]);

  // Record in transaction history
  try {
    await recordMiscTransaction({
      userId, type: 'budget_transfer', amount: amt,
      category: savings.category_name,
      description: `Budget transfer: ${fromCategoryName} → ${savings.category_name}`,
      notes: `Rs ${amt.toLocaleString()} moved from ${fromCategoryName} to ${savings.category_name}`,
    });
  } catch { /* never block the transfer if logging fails */ }

  return { from: updatedFrom, savings: updatedSavings };
};
