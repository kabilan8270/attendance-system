import { Router } from 'express';
import { listShifts, createShift, updateShift, deleteShift, assignShift } from '../controllers/shift.controller';
import { authenticate, requireUserType, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(listShifts));
router.post('/', requireUserType('admin'), requireRole('super_admin', 'admin'), asyncHandler(createShift));
router.put('/:id', requireUserType('admin'), requireRole('super_admin', 'admin'), asyncHandler(updateShift));
router.delete('/:id', requireUserType('admin'), requireRole('super_admin'), asyncHandler(deleteShift));
router.post('/assign', requireUserType('admin'), requireRole('super_admin', 'admin', 'hr'), asyncHandler(assignShift));

export default router;
