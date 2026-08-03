import { Router } from 'express';
import { generateAttendanceReport, generateLeaveReport, generateAttendanceSummary } from '../controllers/report.controller';
import { authenticate, requireUserType } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authenticate, requireUserType('admin'));

router.get('/attendance', asyncHandler(generateAttendanceReport));
router.get('/leave', asyncHandler(generateLeaveReport));
router.get('/attendance-summary', asyncHandler(generateAttendanceSummary));

export default router;
