import express from 'express';
import {
  publicExternalSubmit,
  publicExternalGetRecords,
  publicExternalUpdateRecord,
  publicExternalDeleteRecord,
} from '../controllers/publicApi.controller.js';

const router = express.Router();

/**
 * Shortened routes for External API Integration
 * Base URL: /api/v1/ext
 */

// Submit data
router.post('/', publicExternalSubmit);

// List records
router.get('/', publicExternalGetRecords);

// Update record
router.post('/:recordId', publicExternalUpdateRecord);

// Delete record (using POST as requested)
router.post('/:recordId/delete', publicExternalDeleteRecord);

export default router;
