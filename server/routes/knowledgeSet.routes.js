import express from 'express';
import * as knowledgeSetController from '../controllers/knowledgeSet.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

// 所有端点都需要登录
router.use(protect);

// 显式动作路由，仅使用 GET/POST
router.get('/list', knowledgeSetController.getKnowledgeSets);
router.get('/get/:id', knowledgeSetController.getKnowledgeSet);
router.post('/create', knowledgeSetController.createKnowledgeSet);
router.post('/update', knowledgeSetController.updateKnowledgeSet);
router.post('/delete', knowledgeSetController.deleteKnowledgeSet);

// --- Item Management ---
router.post('/add-items/:id', knowledgeSetController.addItems);
router.get('/get-items/:id', knowledgeSetController.getItems);
router.post('/remove-item/:id', knowledgeSetController.removeItem);
router.post('/test-retrieval/:id', knowledgeSetController.testRetrieval);
router.post('/sync-item/:id', knowledgeSetController.syncItem);

export default router;
