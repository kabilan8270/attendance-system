import { Router } from 'express';
import { listHolidays, createHoliday, updateHoliday, deleteHoliday } from '../controllers/holiday.controller';
import { authenticate, requireUserType, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(listHolidays));
router.post('/', requireUserType('admin'), requireRole('super_admin', 'admin', 'hr'), asyncHandler(createHoliday));
router.put('/:id', requireUserType('admin'), requireRole('super_admin', 'admin', 'hr'), asyncHandler(updateHoliday));
router.delete('/:id', requireUserType('admin'), requireRole('super_admin', 'admin'), asyncHandler(deleteHoliday));

export default router;
