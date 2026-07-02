import express from 'express';
import { createUser, deleteUser, getUser, getUsers, updateUser } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { createUserRules, idParam, updateUserRules } from '../middleware/validators.js';
import { SUPERADMIN_ROLES } from '../utils/accessControl.js';

const router = express.Router();
router.use(protect);
router.get('/', authorize(...SUPERADMIN_ROLES), asyncHandler(getUsers));
router.post('/', authorize(...SUPERADMIN_ROLES), createUserRules, validateRequest, asyncHandler(createUser));
router.get('/:id', authorize(...SUPERADMIN_ROLES), idParam(), validateRequest, asyncHandler(getUser));
router.put('/:id', authorize(...SUPERADMIN_ROLES), idParam(), updateUserRules, validateRequest, asyncHandler(updateUser));
router.delete('/:id', authorize(...SUPERADMIN_ROLES), idParam(), validateRequest, asyncHandler(deleteUser));
export default router;
