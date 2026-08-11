import express from 'express';
import skillController from '../controllers/skill.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { attachOrganization } from '../middleware/permission.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/', attachOrganization, skillController.getAvailableSkills);
router.get('/system', skillController.getSystemSkills);
router.get('/organization', attachOrganization, skillController.getOrganizationSkills);
router.get('/package', skillController.getPackageSkills);
router.get('/discover', attachOrganization, skillController.discoverDocumentSkills);

// Skill Installation
router.post('/install', attachOrganization, skillController.installFromGit);
router.post('/sync', attachOrganization, skillController.syncSkills);
router.post('/uninstall', attachOrganization, skillController.uninstallSkill);

export default router;
