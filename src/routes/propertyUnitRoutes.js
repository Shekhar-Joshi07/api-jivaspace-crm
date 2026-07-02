import express from 'express';
import {
  createPropertyUnit, deletePropertyUnit, getPropertyUnit, getPropertyUnits, updatePropertyUnit
} from '../controllers/propertyUnitController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { createPropertyUnitRules, idParam, updatePropertyUnitRules } from '../middleware/validators.js';
import { ADMIN_ROLES, CRM_ROLES, MANAGEMENT_ROLES } from '../utils/accessControl.js';

const router = express.Router();
router.use(protect);
router.get('/', authorize(...CRM_ROLES), asyncHandler(getPropertyUnits));
router.post('/', authorize(...MANAGEMENT_ROLES), createPropertyUnitRules, validateRequest, asyncHandler(createPropertyUnit));
router.get('/:id', authorize(...CRM_ROLES), idParam(), validateRequest, asyncHandler(getPropertyUnit));
router.put('/:id', authorize(...MANAGEMENT_ROLES), idParam(), updatePropertyUnitRules, validateRequest, asyncHandler(updatePropertyUnit));
router.delete('/:id', authorize(...ADMIN_ROLES), idParam(), validateRequest, asyncHandler(deletePropertyUnit));
export default router;
