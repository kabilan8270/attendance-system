import { Router } from 'express';
import {
  createEmployee,
  listEmployees,
  getEmployee,
  updateEmployee,
  setEmployeeStatus,
  deleteEmployee,
  adminResetEmployeePassword,
  enrollEmployeeFace,
} from '../controllers/employee.controller';
import { authenticate, requireUserType, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate);

// Employee viewing own profile
router.get('/me', requireUserType('employee'), asyncHandler(getEmployee));

// Admin-only employee management
router.post('/', requireUserType('admin'), requireRole('super_admin', 'admin', 'hr'), asyncHandler(createEmployee));
router.get('/', requireUserType('admin'), asyncHandler(listEmployees));
router.get('/:id', requireUserType('admin'), asyncHandler(getEmployee));
router.put('/:id', requireUserType('admin'), requireRole('super_admin', 'admin', 'hr'), asyncHandler(updateEmployee));
router.patch('/:id/status', requireUserType('admin'), requireRole('super_admin', 'admin'), asyncHandler(setEmployeeStatus));
router.delete('/:id', requireUserType('admin'), requireRole('super_admin'), asyncHandler(deleteEmployee));
router.post(
  '/:id/reset-password',
  requireUserType('admin'),
  requireRole('super_admin', 'admin', 'hr'),
  asyncHandler(adminResetEmployeePassword)
);
router.post(
  '/:id/enroll-face',
  requireUserType('admin'),
  requireRole('super_admin', 'admin', 'hr'),
  asyncHandler(enrollEmployeeFace)
);

export default router;
