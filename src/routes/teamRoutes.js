import express from 'express';
import { createTeam, deleteTeam, getTeams, updateTeam } from '../controllers/teamController.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { idParam } from '../middleware/validators.js';
import { ADMIN_ROLES } from '../utils/accessControl.js';

const router = express.Router();
router.use(protect);
router.get('/', authorize(...ADMIN_ROLES), asyncHandler(getTeams));
router.post('/', authorize(...ADMIN_ROLES), asyncHandler(createTeam));
router.put('/:id', authorize(...ADMIN_ROLES), idParam(), validateRequest, asyncHandler(updateTeam));
router.delete('/:id', authorize(...ADMIN_ROLES), idParam(), validateRequest, asyncHandler(deleteTeam));

export default router;
