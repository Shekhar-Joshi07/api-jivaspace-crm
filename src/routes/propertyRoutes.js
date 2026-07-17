import express from 'express';
import { createProperty, deleteProperty, getProperties, getPublicProperties, updateProperty, uploadPropertyImages } from '../controllers/propertyController.js';
import { protect } from '../middleware/auth.js';
import { propertyImageUpload } from '../middleware/uploadMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { idParam } from '../middleware/validators.js';
import { ADMIN_ROLES, CRM_ROLES, MANAGEMENT_ROLES } from '../utils/accessControl.js';
const router = express.Router();

// Published properties are safe to display on the public Jiva Space website.
router.get('/public', asyncHandler(getPublicProperties));
router.use(protect);
router.post('/upload-images', authorize(...MANAGEMENT_ROLES), propertyImageUpload, asyncHandler(uploadPropertyImages));
router.get('/', authorize(...MANAGEMENT_ROLES), asyncHandler(getProperties));
router.post('/', authorize(...MANAGEMENT_ROLES), asyncHandler(createProperty));
router.put('/:id', authorize(...MANAGEMENT_ROLES), idParam(), validateRequest, asyncHandler(updateProperty));
router.delete('/:id', authorize(...ADMIN_ROLES), idParam(), validateRequest, asyncHandler(deleteProperty));
export default router;
