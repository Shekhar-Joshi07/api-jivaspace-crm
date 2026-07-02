import express from 'express';
import {
  createActivity, deleteActivity, getActivities, getActivity, updateActivity
} from '../controllers/activityController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { createActivityRules, idParam, updateActivityRules } from '../middleware/validators.js';
import { CRM_ROLES } from '../utils/accessControl.js';

const router = express.Router();
router.use(protect, authorize(...CRM_ROLES));
router.get('/', asyncHandler(getActivities));
router.post('/', createActivityRules, validateRequest, asyncHandler(createActivity));
router.get('/:id', idParam(), validateRequest, asyncHandler(getActivity));
router.put('/:id', idParam(), updateActivityRules, validateRequest, asyncHandler(updateActivity));
router.delete('/:id', idParam(), validateRequest, asyncHandler(deleteActivity));
export default router;
