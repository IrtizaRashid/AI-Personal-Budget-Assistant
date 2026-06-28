// Routes mounted at /api/ai/recommendations
import { Router } from 'express';
import { getRecommendations } from '../controllers/recommendationController.js';

const router = Router();

router.get('/:userId', getRecommendations); // GET /api/ai/recommendations/:userId

export default router;
