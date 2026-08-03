import { Router } from 'express';
import {
  getDashboardSummary,
  getAttendanceTrend,
  getDepartmentAttendance,
  getPeriodAttendance,
} from '../controllers/dashboard.controller';
import { authenticate, requireUserType } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authenticate, requireUserType('admin'));

router.get('/summary', asyncHandler(getDashboardSummary));
router.get('/trend', asyncHandler(getAttendanceTrend));
router.get('/department-attendance', asyncHandler(getDepartmentAttendance));
router.get('/period-attendance', asyncHandler(getPeriodAttendance));

export default router;
