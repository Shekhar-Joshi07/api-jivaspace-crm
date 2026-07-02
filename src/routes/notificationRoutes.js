import express from 'express';
import {
  createNotification, deleteNotification, getNotification, getNotifications,
  getUnreadCount, markAllAsRead, markAsRead, updateNotification
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { createNotificationRules, idParam } from '../middleware/validators.js';
import { MANAGEMENT_ROLES } from '../utils/accessControl.js';

const router = express.Router();
router.use(protect);
router.get('/', asyncHandler(getNotifications));
router.post(
  '/',
  authorize(...MANAGEMENT_ROLES),
  createNotificationRules,
  validateRequest,
  asyncHandler(createNotification)
);
router.get('/unread-count', asyncHandler(getUnreadCount));
router.patch('/read-all', asyncHandler(markAllAsRead));
router.get('/:id', idParam(), validateRequest, asyncHandler(getNotification));
router.put('/:id', idParam(), validateRequest, asyncHandler(updateNotification));
router.patch('/:id/read', idParam(), validateRequest, asyncHandler(markAsRead));
router.delete('/:id', idParam(), validateRequest, asyncHandler(deleteNotification));
export default router;
