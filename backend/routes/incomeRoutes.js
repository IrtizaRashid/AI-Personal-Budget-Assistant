import { Router } from 'express';
import { getIncome, createIncome, removeIncome } from '../controllers/incomeController.js';

const router = Router();

router.get('/:userId', getIncome);
router.post('/', createIncome);
router.delete('/:incomeId', removeIncome);

export default router;
