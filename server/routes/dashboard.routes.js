import express from 'express';
const router = express.Router();
import { protect } from '../middleware/auth.middleware.js';
import controller from '../controllers/dashboard.controller.js';

// Unified dashboard endpoints
router.get('/favorites', protect, controller.getFavorites);
router.get('/recents', protect, controller.getRecents);
router.post('/favorite', protect, controller.toggleFavorite);
router.post('/recent', protect, controller.touchRecent);
router.get('/summary', protect, controller.getSummary);

router.post('/add-component', protect, controller.addLayoutComponent);
router.post('/set-view', protect, controller.setDashboardView);
router.delete('/delete-component/:layoutId', protect, controller.deleteLayoutComponent);

export default router;
