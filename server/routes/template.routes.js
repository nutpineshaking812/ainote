import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../controllers/template.controller.js';

const router = express.Router();

router.use(protect);

router.route('/templates').get(listTemplates);
router.route('/templates/create').post(createTemplate);
router.route('/templates/update').post(updateTemplate);
router.route('/templates/delete').post(deleteTemplate);
router.route('/templates/:id').get(getTemplate);

export default router;
