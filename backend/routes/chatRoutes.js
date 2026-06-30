// Routes mounted at /api
import { Router } from 'express';
import { chat } from '../controllers/chatController.js';

const router = Router();

router.post('/chat', chat); // POST /api/chat

export default router;
