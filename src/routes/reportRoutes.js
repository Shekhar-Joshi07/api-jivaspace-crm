import express from 'express';
import {
  exportReports,
  leadConversionReport,
  monthlyLeadsReport,
  peopleReport,
  pipelineReport,
  revenueReport,
  sourceWiseReport,
  summaryReport,
  taskCompletionReport,
  userPerformanceReport
} from '../controllers/reportController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { reportQueryRules } from '../middleware/validators.js';
import { MANAGEMENT_ROLES } from '../utils/accessControl.js';

const router = express.Router();
router.use(protect, authorize(...MANAGEMENT_ROLES));
router.use(reportQueryRules, validateRequest);

router.get('/summary', asyncHandler(summaryReport));
router.get('/lead-conversion', asyncHandler(leadConversionReport));
router.get('/pipeline', asyncHandler(pipelineReport));
router.get('/task-completion', asyncHandler(taskCompletionReport));
router.get('/user-performance', asyncHandler(userPerformanceReport));
router.get('/monthly-leads', asyncHandler(monthlyLeadsReport));
router.get('/sources', asyncHandler(sourceWiseReport));
router.get('/revenue', asyncHandler(revenueReport));
router.get('/people', asyncHandler(peopleReport));
router.get('/export', asyncHandler(exportReports));

export default router;
