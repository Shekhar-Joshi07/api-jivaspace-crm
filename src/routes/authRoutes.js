import express from 'express';
import {
  changePassword,
  forgotPassword,
  login,
  logout,
  me,
  register,
  resetPassword
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import {
  changePasswordRules,
  forgotPasswordRules,
  loginRules,
  registerRules,
  resetPasswordRules
} from '../middleware/validators.js';

const router = express.Router();

router.post('/register', registerRules, validateRequest, asyncHandler(register));
router.post('/login', loginRules, validateRequest, asyncHandler(login));
router.post('/forgot-password', forgotPasswordRules, validateRequest, asyncHandler(forgotPassword));
router.post('/reset-password/:token', resetPasswordRules, validateRequest, asyncHandler(resetPassword));
router.get('/me', protect, asyncHandler(me));
router.post('/logout', protect, asyncHandler(logout));
router.put('/change-password', protect, changePasswordRules, validateRequest, asyncHandler(changePassword));

export default router;
