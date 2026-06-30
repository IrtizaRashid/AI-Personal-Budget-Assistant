import { asyncHandler } from '../middleware/asyncHandler.js';
import { getFinancialSnapshot } from '../services/financialService.js';

// GET /api/dashboard/:userId
// Returns the full financial snapshot — single source of truth for the frontend.
export const getDashboard = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const snapshot = await getFinancialSnapshot(userId);
  if (!snapshot.monthlyBudget && snapshot.monthlyBudget !== 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.status(200).json(snapshot);
});
