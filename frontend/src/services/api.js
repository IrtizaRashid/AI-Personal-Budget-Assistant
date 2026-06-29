import axios from 'axios';

const API_ROOT = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const api = axios.create({
  baseURL: `${API_ROOT.replace(/\/$/, '')}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request automatically.
api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- Auth endpoints ----

// POST /api/auth/register
export const registerApi = async (payload) => {
  const { data } = await api.post('/auth/register', payload);
  return data;
};

// POST /api/auth/login
export const loginApi = async (payload) => {
  const { data } = await api.post('/auth/login', payload);
  return data;
};

// GET /api/auth/me
export const getMe = async () => {
  const { data } = await api.get('/auth/me');
  return data;
};

// ---- Budget setup ----

// POST /api/setup-budget
export const setupBudget = async (payload) => {
  const { data } = await api.post('/setup-budget', payload);
  return data;
};

// ---- Dashboard ----

// GET /api/dashboard/:userId
export const getDashboard = async (userId) => {
  const { data } = await api.get(`/dashboard/${userId}`);
  return data;
};

// ---- Categories ----

// GET /api/categories/:userId
export const getCategories = async (userId) => {
  const { data } = await api.get(`/categories/${userId}`);
  return data;
};

// ---- Expenses ----

// GET /api/expenses/:userId
export const getExpenses = async (userId) => {
  const { data } = await api.get(`/expenses/${userId}`);
  return data;
};

// DELETE /api/expenses/:expenseId
export const deleteExpense = async (expenseId) => {
  const { data } = await api.delete(`/expenses/${expenseId}`);
  return data;
};

// ---- Statistics ----

// GET /api/statistics/:userId
export const getStatistics = async (userId) => {
  const { data } = await api.get(`/statistics/${userId}`);
  return data;
};

// ---- AI Recommendations ----

// GET /api/ai/recommendations/:userId
export const getRecommendations = async (userId) => {
  const { data } = await api.get(`/ai/recommendations/${userId}`);
  return data;
};

// ---- Users ----

// POST /api/users/:userId/reset-month
export const resetMonth = async (userId) => {
  const { data } = await api.post(`/users/${userId}/reset-month`);
  return data;
};

export default api;
