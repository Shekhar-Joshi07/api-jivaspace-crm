import express from 'express';
import { createTask, deleteTask, getTask, getTasks, updateTask } from '../controllers/taskController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { createTaskRules, idParam, updateTaskRules } from '../middleware/validators.js';
import { CRM_ROLES } from '../utils/accessControl.js';

const router = express.Router();
router.use(protect, authorize(...CRM_ROLES));
router.get('/', asyncHandler(getTasks));
router.post('/', createTaskRules, validateRequest, asyncHandler(createTask));
router.get('/:id', idParam(), validateRequest, asyncHandler(getTask));
router.put('/:id', idParam(), updateTaskRules, validateRequest, asyncHandler(updateTask));
router.delete('/:id', idParam(), validateRequest, asyncHandler(deleteTask));
export default router;
