import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { getOrgLedger, getMyLedger } from '../controllers/ledger.controller.js';

const router = express.Router();

// Get personal consumption ledger
router.get('/my', protect, getMyLedger);

// Get organization consumption ledger (requires manager permission)
router.get('/organization/:id', protect, getOrgLedger);

export default router;
