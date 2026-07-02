import express from 'express';
import {
  deleteFile, downloadFile, getFile, getFiles, updateFile, uploadFileRecord
} from '../controllers/fileController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { uploadFile } from '../middleware/uploadMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { idParam, updateFileRules } from '../middleware/validators.js';
import { CRM_ROLES } from '../utils/accessControl.js';

const router = express.Router();
router.use(protect, authorize(...CRM_ROLES));
router.get('/', asyncHandler(getFiles));
router.post('/', uploadFile.single('file'), asyncHandler(uploadFileRecord));
router.get('/:id/download', idParam(), validateRequest, downloadFile);
router.get('/:id', idParam(), validateRequest, asyncHandler(getFile));
router.put('/:id', idParam(), updateFileRules, validateRequest, asyncHandler(updateFile));
router.patch('/:id', idParam(), updateFileRules, validateRequest, asyncHandler(updateFile));
router.delete('/:id', idParam(), validateRequest, asyncHandler(deleteFile));
export default router;
