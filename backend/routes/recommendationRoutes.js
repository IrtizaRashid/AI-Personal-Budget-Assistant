// Routes mounted at /api/ai/recommendations
import { Router } from 'express';
import { getRecommendations } from '../controllers/recommendationController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/:userId', authenticate, getRecommendations); // GET /api/ai/recommendations/:userId

export default router;
