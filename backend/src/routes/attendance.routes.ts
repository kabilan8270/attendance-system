import { Router } from 'express';
import {
  markAttendance,
  getMyAttendance,
  getAttendanceAdmin,
  adminUpsertAttendance,
  publicFaceAttendance,
} from '../controllers/attendance.controller';
import { authenticate, requireUserType, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Public kiosk endpoint: no employee/admin login required.
router.post('/public-face', asyncHandler(publicFaceAttendance));

router.use(authenticate);

// Employee endpoints
// Single "Mark Attendance" action — the backend decides IN vs OUT.
router.post('/punch', requireUserType('employee'), asyncHandler(markAttendance));
router.get('/me', requireUserType('employee'), asyncHandler(getMyAttendance));

// Admin endpoints
router.get('/', requireUserType('admin'), asyncHandler(getAttendanceAdmin));
router.post(
  '/override',
  requireUserType('admin'),
  requireRole('super_admin', 'admin', 'hr'),
  asyncHandler(adminUpsertAttendance)
);

export default router;
