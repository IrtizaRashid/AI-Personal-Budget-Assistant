// Data-access layer for the `users` table.
// All SQL for users lives here so controllers stay thin and testable.
import pool from '../database/db.js';

// INSERT a new user, then return the full saved row.
export const createUser = async ({ name, monthly_budget }) => {
  const [result] = await pool.execute(
    'INSERT INTO users (name, monthly_budget) VALUES (?, ?)',
    [name, monthly_budget]
  );
  return findUserById(result.insertId);
};

// SELECT a single user by id (or undefined if not found).
export const findUserById = async (id) => {
  const [rows] = await pool.execute(
    'SELECT id, name, monthly_budget, created_at FROM users WHERE id = ?',
    [id]
  );
  return rows[0];
};

// Increase a user's monthly_budget (loan repayment received — cash inflow).
export const increaseBudget = async (userId, amount) => {
  await pool.execute(
    'UPDATE users SET monthly_budget = monthly_budget + ? WHERE id = ?',
    [Number(amount), userId]
  );
  const user = await findUserById(userId);
  return Number(user.monthly_budget);
};

// Decrease a user's monthly_budget (loan repayment made — cash outflow).
export const decreaseBudget = async (userId, amount) => {
  await pool.execute(
    'UPDATE users SET monthly_budget = GREATEST(0, monthly_budget - ?) WHERE id = ?',
    [Number(amount), userId]
  );
  const user = await findUserById(userId);
  return Number(user.monthly_budget);
};
