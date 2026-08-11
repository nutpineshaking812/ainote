import express from 'express';
import workflowController from '../controllers/workflow.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public webhook endpoints
router.all('/webhook/:id', workflowController.handleWebhook);
router.all('/webhook/:id/executions/:executionId/cancel', workflowController.handleCancelWebhook);

router.use(protect);

router.route('/').post(workflowController.createWorkflow).get(workflowController.getWorkflows);

// Executions (Must be before /:id to avoid being caught by it)
router.get('/executions', workflowController.getAllExecutions);

router
  .route('/:id')
  .get(workflowController.getWorkflowById)
  .patch(workflowController.updateWorkflow)
  .delete(workflowController.deleteWorkflow);

router.get('/:id/interface', workflowController.getWorkflowInterface);

router.post('/:id/publish', workflowController.publishWorkflow);
router.post('/:id/detach', workflowController.detachWorkflow);
router.post('/:id/unlink-app', workflowController.unlinkApp);
router.post('/:id/status', workflowController.toggleStatus);
router.post('/:id/reset', workflowController.resetWorkflow);
router.post('/:id/execute', workflowController.executeWorkflow);
router.post('/:id/stream-execute', workflowController.streamWorkflow);
router.get('/:id/stream', workflowController.streamWorkflowEvents);

// Execution Detail Routes (already include :id, so safe)
router.get('/:id/executions', workflowController.getWorkflowExecutions);
router.get('/:id/executions/:executionId', workflowController.getExecutionById);
router.post('/:id/executions/:executionId/cancel', workflowController.cancelExecution);

router.post('/debug-node', workflowController.debugNode);
export default router;
