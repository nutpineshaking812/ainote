import express from 'express';
import * as deController from '../controllers/digitalEmployee.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

router.use(protect);

router.get('/presets', deController.getPresets);
router.get('/get-list', deController.getEmployees);
router.get('/get-detail', deController.getEmployee);
router.post('/create', deController.createEmployee);
router.post('/update', deController.updateEmployee);
router.post('/delete', deController.deleteEmployee);
router.post('/:id/init-workflow', deController.initializeWorkflow);

export default router;
