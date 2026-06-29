// Routes mounted at /api/dashboard
import { Router } from 'express';
import { getDashboard } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/:userId', authenticate, getDashboard); // GET /api/dashboard/:userId

export default router;
