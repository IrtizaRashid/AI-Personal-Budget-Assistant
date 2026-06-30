import express from 'express';
import { universalQuery } from '../controllers/aiQueryController.js';

const router = express.Router();

// POST /api/ai/query
router.post('/query', universalQuery);

export default router;
