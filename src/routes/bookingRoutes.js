import express from 'express';
import {
  createBooking, deleteBooking, getBooking, getBookings, updateBooking
} from '../controllers/bookingController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { createBookingRules, idParam, updateBookingRules } from '../middleware/validators.js';
import { ADMIN_ROLES, CRM_ROLES } from '../utils/accessControl.js';

const router = express.Router();
router.use(protect, authorize(...CRM_ROLES));
router.get('/', asyncHandler(getBookings));
router.post('/', createBookingRules, validateRequest, asyncHandler(createBooking));
router.get('/:id', idParam(), validateRequest, asyncHandler(getBooking));
router.put('/:id', idParam(), updateBookingRules, validateRequest, asyncHandler(updateBooking));
router.delete('/:id', authorize(...ADMIN_ROLES), idParam(), validateRequest, asyncHandler(deleteBooking));
export default router;
