import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  getAdminSessions,
  logoutAdminDevice,
  logoutAdminAllDevices,
} from '../controllers/admin.controller';
import { authenticate, requireUserType } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Every route here is for the logged-in admin's own account.
router.use(authenticate, requireUserType('admin'));

// Tighter limiter on sensitive write actions (profile edits, password
// changes, session revocation) to slow down credential-stuffing / abuse
// even from an already-authenticated token.
const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/profile', asyncHandler(getAdminProfile));
router.put('/profile', sensitiveActionLimiter, asyncHandler(updateAdminProfile));

router.put('/change-password', sensitiveActionLimiter, asyncHandler(changeAdminPassword));

router.get('/sessions', asyncHandler(getAdminSessions));
router.delete('/logout-device', sensitiveActionLimiter, asyncHandler(logoutAdminDevice));
router.delete('/logout-all', sensitiveActionLimiter, asyncHandler(logoutAdminAllDevices));

export default router;
