import express from 'express';
import channelController from '../controllers/channel.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect); // All channel routes are protected

router.get('/', channelController.getChannels);
router.post('/create', channelController.createChannel);
router.post('/update', channelController.updateChannel);
router.post('/delete', channelController.deleteChannel);

router.get('/:id', channelController.getChannels);
router.get('/:id/test', channelController.testConnection);
router.post('/:id/test', channelController.testConnection);

export default router;
