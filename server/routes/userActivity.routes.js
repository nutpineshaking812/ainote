import express from 'express';
const router = express.Router();
import { protect } from '../middleware/auth.middleware.js';
import controller from '../controllers/userActivity.controller.js';

router.get('/recent-apps', protect, controller.getRecentApps);
router.post('/recent-apps', protect, controller.pushRecentApp);

router.get('/favorites', protect, controller.getFavorites);
router.post('/favorites/toggle', protect, controller.toggleFavorite);

export default router;
