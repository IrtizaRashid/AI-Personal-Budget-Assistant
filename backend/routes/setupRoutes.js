// Routes mounted at /api
import { Router } from 'express';
import { setupBudget } from '../controllers/setupController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/setup-budget', authenticate, setupBudget); // POST /api/setup-budget

export default router;
