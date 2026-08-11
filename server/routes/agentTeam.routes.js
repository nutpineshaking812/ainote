import { Router } from 'express';
import * as controller from '../controllers/agentTeam.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router({ mergeParams: true });

router.get('/get-list', protect, controller.getTeams);
router.post('/create', protect, controller.createTeam);
router.post('/delete', protect, controller.deleteTeam);

export default router;
