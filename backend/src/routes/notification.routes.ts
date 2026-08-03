import { Router } from 'express';
import { getMyNotifications, markNotificationRead, markAllNotificationsRead } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(getMyNotifications));
router.patch('/:id/read', asyncHandler(markNotificationRead));
router.patch('/read-all', asyncHandler(markAllNotificationsRead));

export default router;
