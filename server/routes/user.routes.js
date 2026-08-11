import express from 'express';
const router = express.Router();
import { protect } from '../middleware/auth.middleware.js';
import {
  updateUserProfile,
  changePassword,
  getUserQuota,
} from '../controllers/user.controller.js';

router.get('/quota', protect, getUserQuota);
router.put('/profile', protect, updateUserProfile);
router.put('/password', protect, changePassword);

export default router;