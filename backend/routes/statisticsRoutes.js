// Routes mounted at /api/statistics
import { Router } from 'express';
import { getStatistics } from '../controllers/statisticsController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/:userId', authenticate, getStatistics); // GET /api/statistics/:userId

export default router;
