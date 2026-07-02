import express from 'express';
import {
  createTransferLog, deleteTransferLog, getTransferLog, getTransferLogs, updateTransferLog
} from '../controllers/transferController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { idParam } from '../middleware/validators.js';
import { MANAGEMENT_ROLES } from '../utils/accessControl.js';

const router = express.Router();
router.use(protect, authorize(...MANAGEMENT_ROLES));
router.get('/', asyncHandler(getTransferLogs));
router.post('/', asyncHandler(createTransferLog));
router.get('/:id', idParam(), validateRequest, asyncHandler(getTransferLog));
router.put('/:id', idParam(), validateRequest, asyncHandler(updateTransferLog));
router.delete('/:id', authorize('superadmin'), idParam(), validateRequest, asyncHandler(deleteTransferLog));
export default router;
