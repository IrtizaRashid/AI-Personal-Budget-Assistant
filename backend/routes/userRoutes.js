// Routes mounted at /api/users
import { Router } from 'express';
import { createUser, resetMonth } from '../controllers/userController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// POST /api/users is no longer needed — user creation happens via /api/auth/register
router.post('/:userId/reset-month', authenticate, resetMonth); // POST /api/users/:userId/reset-month

export default router;
