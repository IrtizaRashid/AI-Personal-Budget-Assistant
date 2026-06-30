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

// ---- Budget allocation update ----

// PUT /api/budget-allocation
export const updateBudgetAllocation = async (payload) => {
  const { data } = await api.put('/budget-allocation', payload);
  return data;
};

// ---- Income ----

// GET /api/income/:userId
export const getIncome = async (userId) => {
  const { data } = await api.get(`/income/${userId}`);
  return data;
};

// POST /api/income
export const createIncome = async (payload) => {
  const { data } = await api.post('/income', payload);
  return data;
};

// DELETE /api/income/:incomeId
export const deleteIncomeRecord = async (incomeId) => {
  const { data } = await api.delete(`/income/${incomeId}`);
  return data;
};

// ---- Loans ----

// GET /api/loans/:userId
export const getLoans = async (userId) => {
  const { data } = await api.get(`/loans/${userId}`);
  return data;
};

// PUT /api/loans/:loanId/paid
export const markLoanPaid = async (loanId) => {
  const { data } = await api.put(`/loans/${loanId}/paid`);
  return data;
};

// PUT /api/loans/:loanId
export const updateLoan = async (loanId, payload) => {
  const { data } = await api.put(`/loans/${loanId}`, payload);
  return data;
};

// DELETE /api/loans/:loanId
export const deleteLoan = async (loanId) => {
  const { data } = await api.delete(`/loans/${loanId}`);
  return data;
};

// GET /api/loans/:userId/summary
export const getLoanSummary = async (userId) => {
  const { data } = await api.get(`/loans/${userId}/summary`);
  return data;
};

// GET /api/transactions/:userId
export const getTransactions = async (userId) => {
  const { data } = await api.get(`/transactions/${userId}`);
  return data;
};

// GET /api/loans/:loanId/payments
export const getLoanPayments = async (loanId) => {
  const { data } = await api.get(`/loans/${loanId}/payments`);
  return data;
};

// ---- Investments ----

// GET /api/investments/:userId/portfolio
export const getPortfolio = async (userId) => {
  const { data } = await api.get(`/investments/${userId}/portfolio`);
  return data;
};

// GET /api/investments/:userId/summary
export const getInvestmentSummary = async (userId) => {
  const { data } = await api.get(`/investments/${userId}/summary`);
  return data;
};

// GET /api/investments/:userId/transactions
export const getInvestmentTransactions = async (userId) => {
  const { data } = await api.get(`/investments/${userId}/transactions`);
  return data;
};

// ---- Universal AI Query ----

// POST /api/ai/query
export const universalQuery = async (payload) => {
  const { data } = await api.post('/ai/query', payload);
  return data;
};

// POST /api/loans/split
export const createSplitExpense = async (payload) => {
  const { data } = await api.post('/loans/split', payload);
  return data;
};

// ---- Users ----

// POST /api/users/:userId/reset-month
export const resetMonth = async (userId) => {
  const { data } = await api.post(`/users/${userId}/reset-month`);
  return data;
};

export default api;
