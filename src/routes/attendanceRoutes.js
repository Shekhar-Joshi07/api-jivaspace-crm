import express from 'express';
import {
  checkIn,
  checkOut,
  getAttendanceAudit,
  getAttendanceConfiguration,
  getTodayAttendance,
  updateAttendanceConfiguration
} from '../controllers/attendanceController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { attendanceConfigRules, attendanceLocationRules, validateAttendanceAuditRules } from '../middleware/validators.js';
import { CRM_ROLES, SUPERADMIN_ROLES } from '../utils/accessControl.js';
import { validateRequest } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.use(protect, authorize(...CRM_ROLES));
router.get('/today', asyncHandler(getTodayAttendance));
router.post('/check-in', attendanceLocationRules, validateRequest, asyncHandler(checkIn));
router.post('/check-out', attendanceLocationRules, validateRequest, asyncHandler(checkOut));
router.get('/config', asyncHandler(getAttendanceConfiguration));
router.get('/audit', authorize(...SUPERADMIN_ROLES), validateAttendanceAuditRules, validateRequest, asyncHandler(getAttendanceAudit));
router.put('/config', authorize(...SUPERADMIN_ROLES), attendanceConfigRules, validateRequest, asyncHandler(updateAttendanceConfiguration));

export default router;
