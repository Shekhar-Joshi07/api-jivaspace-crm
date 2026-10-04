import express from 'express';
import { approveUser, createUser, deleteUser, getUser, getUsers, updateUser } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { createUserRules, idParam, updateUserRules } from '../middleware/validators.js';
import { ADMIN_ROLES, SUPERADMIN_ROLES } from '../utils/accessControl.js';

const router = express.Router();
router.use(protect);
// Admins need the active sales-executive directory to assign and transfer leads.
// Account management endpoints remain restricted to Super Admins below.
router.get('/', authorize(...ADMIN_ROLES), asyncHandler(getUsers));
router.post('/', authorize(...SUPERADMIN_ROLES), createUserRules, validateRequest, asyncHandler(createUser));
router.patch('/:id/approve', authorize(...SUPERADMIN_ROLES), idParam(), validateRequest, asyncHandler(approveUser));
router.get('/:id', authorize(...SUPERADMIN_ROLES), idParam(), validateRequest, asyncHandler(getUser));
router.put('/:id', authorize(...SUPERADMIN_ROLES), idParam(), updateUserRules, validateRequest, asyncHandler(updateUser));
router.delete('/:id', authorize(...SUPERADMIN_ROLES), idParam(), validateRequest, asyncHandler(deleteUser));
export default router;
