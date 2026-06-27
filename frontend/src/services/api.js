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

// GET /api/health -> { status: "Server Running" }
export const checkHealth = async () => {
  const { data } = await api.get('/health');
  return data;
};

export default api;
