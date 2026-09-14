import express from 'express';
import verifyFirebaseToken from '../middleware/verifyFirebaseToken.js';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../controllers/notificationController.js';

const router = express.Router();

router.get('/', verifyFirebaseToken, getNotifications);
router.get('/unread-count', verifyFirebaseToken, getUnreadCount);
router.patch('/:id/read', verifyFirebaseToken, markAsRead);
router.post('/mark-all-read', verifyFirebaseToken, markAllAsRead);
router.delete('/:id', verifyFirebaseToken, deleteNotification);

export default router;
