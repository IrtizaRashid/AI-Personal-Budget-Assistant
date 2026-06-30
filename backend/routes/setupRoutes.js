// Routes mounted at /api
import { Router } from 'express';
import {
  setupBudget,
  updateBudgetAllocation,
} from '../controllers/setupController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/setup-budget', authenticate, setupBudget); // POST /api/setup-budget
router.put('/budget-allocation', authenticate, updateBudgetAllocation); // PUT /api/budget-allocation

export default router;
