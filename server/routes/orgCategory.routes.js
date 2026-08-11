import express from 'express';
import orgCategoryController from '../controllers/orgCategory.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { attachOrganization } from '../middleware/permission.middleware.js';

const router = express.Router();

router.use(protect); // Ensure user is authenticated

router.get('/', attachOrganization, orgCategoryController.getCategories);
router.post('/create', attachOrganization, orgCategoryController.createCategory);
router.post('/update', attachOrganization, orgCategoryController.updateCategory);
router.post('/delete', attachOrganization, orgCategoryController.deleteCategory);

export default router;
