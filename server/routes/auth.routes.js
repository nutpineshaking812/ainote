import express from 'express';
import { register, login, getInvitations, generateInvitation, verifyInvitation } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';


const router = express.Router();

// @route   /api/v1/auth
router.post('/register', register);
router.post('/login', login);
router.get('/invitation/:code', verifyInvitation);


// Invitation management
router.get('/invitations', protect, getInvitations);
router.post('/invitations', protect, generateInvitation);

export default router;


