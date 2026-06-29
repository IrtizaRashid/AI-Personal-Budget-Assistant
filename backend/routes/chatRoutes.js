// Routes mounted at /api
import { Router } from 'express';
import { chat } from '../controllers/chatController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/chat', authenticate, chat); // POST /api/chat

export default router;
