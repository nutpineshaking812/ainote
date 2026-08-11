import express from 'express';
import * as adsController from '../controllers/agentDockState.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

// 所有 Dock State 接口均需身份认证
router.use(protect);

router.get('/get-detail', adsController.getDockState);
router.post('/update', adsController.updateDockState);

export default router;
