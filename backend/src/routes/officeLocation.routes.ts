import { Router } from 'express';
import {
  listOfficeLocations,
  createOfficeLocation,
  updateOfficeLocation,
  deleteOfficeLocation,
} from '../controllers/officeLocation.controller';
import { authenticate, requireUserType, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authenticate, requireUserType('admin'));

router.get('/', asyncHandler(listOfficeLocations));
router.post('/', requireRole('super_admin', 'admin'), asyncHandler(createOfficeLocation));
router.put('/:id', requireRole('super_admin', 'admin'), asyncHandler(updateOfficeLocation));
router.delete('/:id', requireRole('super_admin'), asyncHandler(deleteOfficeLocation));

export default router;
