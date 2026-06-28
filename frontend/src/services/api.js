// Central Axios instance and API helpers.
// Keeping all HTTP calls here (instead of scattered across components)
// makes the app modular: future endpoints (budgets, expenses, AI) just
// add a function in this file.
import axios from 'axios';

// Base URL of the Express backend. In later steps this can be moved
// to a Vite env var (import.meta.env.VITE_API_URL).
const api = axios.create({
  baseURL: 'http://localhost:5001/api',
  headers: { 'Content-Type': 'application/json' },
});

// POST /api/setup-budget
// payload: { name, monthlyBudget, categories: [{ category, allocatedAmount }] }
export const setupBudget = async (payload) => {
  const { data } = await api.post('/setup-budget', payload);
  return data;
};

// GET /api/dashboard/:userId
// -> { monthlyBudget, totalSpent, remainingBudget }
export const getDashboard = async (userId) => {
  const { data } = await api.get(`/dashboard/${userId}`);
  return data;
};

// GET /api/categories/:userId
// -> [{ category, allocated, spent, remaining }]
export const getCategories = async (userId) => {
  const { data } = await api.get(`/categories/${userId}`);
  return data;
};

// GET /api/expenses/:userId  -> [{ id, category, amount, description, expense_date }]
export const getExpenses = async (userId) => {
  const { data } = await api.get(`/expenses/${userId}`);
  return data;
};

// DELETE /api/expenses/:expenseId
export const deleteExpense = async (expenseId) => {
  const { data } = await api.delete(`/expenses/${expenseId}`);
  return data;
};

// GET /api/statistics/:userId
// -> { allocated[], spent[], remaining[], expenseCount }
export const getStatistics = async (userId) => {
  const { data } = await api.get(`/statistics/${userId}`);
  return data;
};

export default api;
