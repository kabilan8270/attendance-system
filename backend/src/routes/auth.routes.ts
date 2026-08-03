import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  adminLogin,
  employeeLogin,
  refreshAccessToken,
  logout,
  logoutAllDevices,
  forgotPassword,
  resetPassword,
  changePassword,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Strict rate limit on login endpoints to prevent brute force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/admin/login', loginLimiter, asyncHandler(adminLogin));
router.post('/employee/login', loginLimiter, asyncHandler(employeeLogin));
router.post('/refresh', asyncHandler(refreshAccessToken));
router.post('/logout', asyncHandler(logout));
router.post('/logout-all', authenticate, asyncHandler(logoutAllDevices));
router.post('/forgot-password', loginLimiter, asyncHandler(forgotPassword));
router.post('/reset-password', asyncHandler(resetPassword));
router.post('/change-password', authenticate, asyncHandler(changePassword));

export default router;
