import { Router } from 'express';
import { listDepartments, createDepartment, updateDepartment, deleteDepartment } from '../controllers/department.controller';
import { authenticate, requireUserType, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(listDepartments));
router.post('/', requireUserType('admin'), requireRole('super_admin', 'admin', 'hr'), asyncHandler(createDepartment));
router.put('/:id', requireUserType('admin'), requireRole('super_admin', 'admin', 'hr'), asyncHandler(updateDepartment));
router.delete('/:id', requireUserType('admin'), requireRole('super_admin'), asyncHandler(deleteDepartment));

export default router;
