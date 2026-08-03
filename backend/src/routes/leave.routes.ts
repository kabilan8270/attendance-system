import { Router } from 'express';
import {
  createLeaveRequest,
  cancelLeaveRequest,
  getMyLeaves,
  listLeaveRequestsAdmin,
  approveLeaveRequest,
  rejectLeaveRequest,
  adminCancelLeaveRequest,
  adminAddLeave,
} from '../controllers/leave.controller';
import { authenticate, requireUserType, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authenticate);

// Employee
router.post('/', requireUserType('employee'), asyncHandler(createLeaveRequest));
router.get('/me', requireUserType('employee'), asyncHandler(getMyLeaves));
router.patch('/:id/cancel', requireUserType('employee'), asyncHandler(cancelLeaveRequest));

// Admin
router.get('/', requireUserType('admin'), asyncHandler(listLeaveRequestsAdmin));
router.patch('/:id/approve', requireUserType('admin'), requireRole('super_admin', 'admin', 'hr'), asyncHandler(approveLeaveRequest));
router.patch('/:id/reject', requireUserType('admin'), requireRole('super_admin', 'admin', 'hr'), asyncHandler(rejectLeaveRequest));
router.patch('/:id/admin-cancel', requireUserType('admin'), requireRole('super_admin', 'admin'), asyncHandler(adminCancelLeaveRequest));
router.post('/admin-add', requireUserType('admin'), requireRole('super_admin', 'admin', 'hr'), asyncHandler(adminAddLeave));

export default router;
