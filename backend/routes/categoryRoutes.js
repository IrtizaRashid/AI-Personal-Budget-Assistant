// Routes mounted at /api/categories
import { Router } from 'express';
import {
  createCategories,
  getCategories,
} from '../controllers/categoryController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/', authenticate, createCategories);     // POST /api/categories
router.get('/:userId', authenticate, getCategories);  // GET  /api/categories/:userId

export default router;
