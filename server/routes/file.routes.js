import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import fileController from '../controllers/file.controller.js';

const router = express.Router();

/**
 * Upload Configuration & Registration
 */

// GET /api/v1/files/get-config
router.get('/get-config', protect, fileController.getUploadConfig);

// POST /api/v1/files/register
router.post('/register', protect, fileController.registerUploadedFile);

// POST /api/v1/files/convert-markitdown
router.post('/convert-markitdown', protect, fileController.convertMarkitdown);

/**
 * File Metadata & Download
 */

// GET /api/v1/files/:id/get-info
router.get('/:id/get-info', protect, fileController.getFileMeta);

// GET /api/v1/files/:id/download
router.get('/:id/download', protect, fileController.downloadFile);

export default router;
