import express from 'express';
import {
  getCommunicationLogs,
  sendLeadEmail,
  sendLeadSMS
} from '../controllers/communicationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { emailRules, idParam, smsRules } from '../middleware/validators.js';
import { CRM_ROLES } from '../utils/accessControl.js';

const router = express.Router();
const crmRoles = CRM_ROLES;
const sendRoles = CRM_ROLES;

router.use(protect);
router.get('/', authorize(...crmRoles), asyncHandler(getCommunicationLogs));
router.post(
  '/leads/:leadId/email',
  authorize(...sendRoles),
  idParam('leadId'),
  emailRules,
  validateRequest,
  asyncHandler(sendLeadEmail)
);
router.post(
  '/leads/:leadId/sms',
  authorize(...sendRoles),
  idParam('leadId'),
  smsRules,
  validateRequest,
  asyncHandler(sendLeadSMS)
);

export default router;
