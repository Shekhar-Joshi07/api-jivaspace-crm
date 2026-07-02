import express from 'express';
import {
  addNote,
  addActivityTimelineEntry,
  assignLead,
  bulkImportLeads,
  bulkTransferLeads,
  createLead,
  deleteLead,
  exportLeadsToExcel,
  checkDuplicateMobile,
  getCalendarFollowUps,
  getLead,
  getLeadResponses,
  getLeads,
  getPendingLeads,
  getPipeline,
  importLeadsFromExcel,
  transferLead,
  updateLead,
  updateLeadStatus,
  updateLeadResponse
} from '../controllers/leadController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { uploadSpreadsheet } from '../middleware/uploadMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import {
  assignLeadRules,
  createLeadRules,
  duplicateMobileRules,
  idParam,
  leadRemarkRules,
  leadTimelineRules,
  noteRules,
  transferLeadRules,
  updateLeadRules,
  updateLeadStatusRules
} from '../middleware/validators.js';
import { ADMIN_ROLES, CRM_ROLES } from '../utils/accessControl.js';

const router = express.Router();
router.use(protect, authorize(...CRM_ROLES));

router.get('/pipeline', asyncHandler(getPipeline));
router.get('/responses', asyncHandler(getLeadResponses));
router.get('/pending', asyncHandler(getPendingLeads));
router.get('/calendar', asyncHandler(getCalendarFollowUps));
router.get('/export', authorize(...ADMIN_ROLES), asyncHandler(exportLeadsToExcel));
router.get('/duplicate-mobile', duplicateMobileRules, validateRequest, asyncHandler(checkDuplicateMobile));
router.post('/import', authorize(...ADMIN_ROLES), uploadSpreadsheet.single('file'), asyncHandler(importLeadsFromExcel));
router.post('/bulk-import', authorize(...ADMIN_ROLES), asyncHandler(bulkImportLeads));
router.post(
  '/transfer',
  authorize(...ADMIN_ROLES),
  transferLeadRules,
  validateRequest,
  asyncHandler(transferLead)
);
router.post('/bulk-transfer', authorize(...ADMIN_ROLES), asyncHandler(bulkTransferLeads));

router.get('/', asyncHandler(getLeads));
router.post('/', authorize(...ADMIN_ROLES), createLeadRules, validateRequest, asyncHandler(createLead));
router.get('/:id', idParam(), validateRequest, asyncHandler(getLead));
router.put('/:id', authorize(...ADMIN_ROLES), idParam(), updateLeadRules, validateRequest, asyncHandler(updateLead));
router.delete('/:id', authorize(...ADMIN_ROLES), idParam(), validateRequest, asyncHandler(deleteLead));
router.patch('/:id/status', idParam(), updateLeadStatusRules, validateRequest, asyncHandler(updateLeadStatus));
router.patch('/:id/response', idParam(), updateLeadStatusRules, validateRequest, asyncHandler(updateLeadResponse));
router.post('/:id/remarks', idParam(), leadRemarkRules, validateRequest, asyncHandler(addNote));
router.post('/:id/timeline', idParam(), leadTimelineRules, validateRequest, asyncHandler(addActivityTimelineEntry));
router.patch(
  '/:id/assign',
  authorize(...ADMIN_ROLES),
  idParam(),
  assignLeadRules,
  validateRequest,
  asyncHandler(assignLead)
);
router.post('/:id/notes', idParam(), noteRules, validateRequest, asyncHandler(addNote));

export default router;
