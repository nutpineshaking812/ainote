import express from 'express';
import controller from '../controllers/orgWidget.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import asyncHandler from 'express-async-handler';

const router = express.Router();

router.use(protect);

router.post('/create', asyncHandler(controller.createWidget));
router.get('/', asyncHandler(controller.getWidgets));
router.post('/:widgetId/update', asyncHandler(controller.updateWidget));
router.post('/:widgetId/delete', asyncHandler(controller.deleteWidget));

export default router;
