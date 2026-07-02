import express from 'express';
import {
  createProject, deleteProject, getProject, getProjects, updateProject
} from '../controllers/projectController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { createProjectRules, idParam, updateProjectRules } from '../middleware/validators.js';
import { ADMIN_ROLES, CRM_ROLES, MANAGEMENT_ROLES } from '../utils/accessControl.js';

const router = express.Router();
router.use(protect);
router.get('/', authorize(...CRM_ROLES), asyncHandler(getProjects));
router.post('/', authorize(...MANAGEMENT_ROLES), createProjectRules, validateRequest, asyncHandler(createProject));
router.get('/:id', authorize(...CRM_ROLES), idParam(), validateRequest, asyncHandler(getProject));
router.put('/:id', authorize(...MANAGEMENT_ROLES), idParam(), updateProjectRules, validateRequest, asyncHandler(updateProject));
router.delete('/:id', authorize(...ADMIN_ROLES), idParam(), validateRequest, asyncHandler(deleteProject));
export default router;
