import express from 'express';
const router = express.Router();
import { protect } from '../middleware/auth.middleware.js';
import ctrl from '../controllers/viewComponent.controller.js';

router.use(protect);

// List & create
router.get('/apps/:appId/components', ctrl.doListComponents);
router.post('/apps/:appId/components/create', ctrl.doCreateComponent);
router.post('/apps/:appId/components/from-message', ctrl.doCreateComponentFromMessage);

// Single
router.get('/components/:componentId', ctrl.doGetComponent);
router.get('/components/:componentId/data', ctrl.getComponentData);

// Action endpoints (POST only)
router.post('/components/update', ctrl.doUpdateComponent);
router.post('/components/delete', ctrl.doDeleteComponent);

export default router;