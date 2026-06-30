// Routes mounted at /api/dashboard
import { Router } from 'express';
import { getDashboard } from '../controllers/dashboardController.js';

const router = Router();

router.get('/:userId', getDashboard); // GET /api/dashboard/:userId

export default router;
