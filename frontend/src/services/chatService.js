// API service for the AI chat feature.
// Reuses the shared Axios instance from api.js.
import api from './api.js';

// POST /api/chat
// Sends the user's natural-language message; the backend returns a
// structured result (intent + data) which the ChatBox renders.
export const sendChatMessage = async (userId, message) => {
  const { data } = await api.post('/chat', { userId, message });
  return data;
};

// POST /api/expenses/confirm
// Resolves an over-budget expense after the user picks an option.
// action = 'transfer' | 'over_budget' | 'cancel'
export const confirmExpenseAction = async ({
  userId,
  action,
  expense,
  fromCategory,
}) => {
  const { data } = await api.post('/expenses/confirm', {
    userId,
    action,
    expense,
    fromCategory,
  });
  return data;
};
