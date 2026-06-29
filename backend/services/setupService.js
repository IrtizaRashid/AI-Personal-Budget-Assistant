// Data-access layer for the first-time budget setup.
// Works with an already-authenticated user — updates their budget
// and replaces their categories in a single transaction.
import pool from '../database/db.js';

export const setupBudgetForUser = async ({ userId, monthlyBudget, categories }) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Update the user's monthly budget.
    await connection.execute(
      'UPDATE users SET monthly_budget = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [monthlyBudget, userId]
    );

    // Remove any existing categories so re-setup is idempotent.
    await connection.execute(
      'DELETE FROM budget_categories WHERE user_id = ?',
      [userId]
    );

    // Also reset expenses when re-doing setup (fresh start).
    // Remove this block if you want to keep historical expenses on re-setup.
    // await connection.execute('DELETE FROM expenses WHERE user_id = ?', [userId]);

    // Insert all new categories.
    const values = categories.map((c) => [
      userId,
      c.category,
      c.allocatedAmount,
      0,
    ]);

    await connection.query(
      `INSERT INTO budget_categories
         (user_id, category_name, allocated_amount, spent_amount)
       VALUES ?`,
      [values]
    );

    await connection.commit();
    return { userId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
