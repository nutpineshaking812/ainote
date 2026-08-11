import express from 'express';
import * as mcpController from '../controllers/mcp.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.route('/').post(mcpController.installServer).get(mcpController.getServers);

router.route('/:id').delete(mcpController.deleteServer).patch(mcpController.updateStatus);

router.post('/:id/refresh', mcpController.refreshServer);

export default router;
