import express from 'express';
import {
  createSiteVisit, deleteSiteVisit, getSiteVisit, getSiteVisits, updateSiteVisit
} from '../controllers/siteVisitController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { createSiteVisitRules, idParam, updateSiteVisitRules } from '../middleware/validators.js';
import { CRM_ROLES, MANAGEMENT_ROLES } from '../utils/accessControl.js';

const router = express.Router();
router.use(protect, authorize(...CRM_ROLES));
router.get('/', asyncHandler(getSiteVisits));
router.post('/', createSiteVisitRules, validateRequest, asyncHandler(createSiteVisit));
router.get('/:id', idParam(), validateRequest, asyncHandler(getSiteVisit));
router.put('/:id', idParam(), updateSiteVisitRules, validateRequest, asyncHandler(updateSiteVisit));
router.delete('/:id', authorize(...MANAGEMENT_ROLES), idParam(), validateRequest, asyncHandler(deleteSiteVisit));
export default router;
