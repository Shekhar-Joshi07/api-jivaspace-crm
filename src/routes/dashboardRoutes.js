import express from 'express';
import { calendar, stats } from '../controllers/dashboardController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { CRM_ROLES } from '../utils/accessControl.js';

const router = express.Router();
router.use(protect, authorize(...CRM_ROLES));
router.get('/stats', asyncHandler(stats));
router.get('/counts', asyncHandler(stats));
router.get('/status-counts', asyncHandler(stats));
router.get('/calendar', asyncHandler(calendar));
export default router;
