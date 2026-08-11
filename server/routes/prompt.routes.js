import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  listPrompts,
  getPromptDashboard,
  getPrompt,
  createPrompt,
  updatePrompt,
  deletePrompt,
} from '../controllers/prompt.controller.js';

const router = express.Router();

router.use(protect);

router.get('/', listPrompts);
router.get('/dashboard', getPromptDashboard);
router.post('/create', createPrompt);
router.post('/update', updatePrompt);
router.post('/delete', deletePrompt);
router.get('/:id', getPrompt);

export default router;
