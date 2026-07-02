import crypto from 'node:crypto';
import User, { normalizeUserRole } from '../models/User.js';
import { sendPasswordResetEmail } from '../services/emailService.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { generateToken } from '../utils/generateToken.js';

const publicUser = user => ({
  id: user._id,
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  avatarUrl: user.avatarUrl,
  isActive: user.isActive
});

export const register = async (req, res) => {
  const { name, email, password, phone } = req.body;
  const normalizedEmail = email.trim().toLowerCase();

  if (await User.exists({ email: normalizedEmail })) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  // The first account bootstraps the system. Later public signups are least-privileged.
  const isFirstUser = (await User.countDocuments()) === 0;
  const user = await User.create({
    name,
    email: normalizedEmail,
    password,
    phone,
    role: isFirstUser ? 'superadmin' : 'sales_executive'
  });

  const token = generateToken(user);
  return res.status(201).json({
    success: true,
    message: 'Account created successfully',
    token,
    user: publicUser(user)
  });
};

export const login = async (req, res) => {
  const normalizedEmail = req.body.email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select('+password');

  if (!user || !(await user.matchPassword(req.body.password))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!user.isActive) throw new ApiError(403, 'This account has been deactivated');

  user.role = normalizeUserRole(user.role);
  if (user.role === 'admin' && !(await User.exists({ role: 'superadmin' }))) {
    user.role = 'superadmin';
  }
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  return res.json({
    success: true,
    token: generateToken(user),
    user: publicUser(user)
  });
};

export const me = async (req, res) => sendSuccess(res, { data: publicUser(req.user) });

export const logout = async (_req, res) => sendSuccess(res, {
  message: 'Logged out successfully. Remove the token from the client.'
});

export const forgotPassword = async (req, res) => {
  const genericResponse = {
    message: 'If an active account exists for that email, a reset link has been sent.'
  };
  const user = await User.findOne({
    email: req.body.email.trim().toLowerCase(),
    isActive: true
  }).select('+resetPasswordToken +resetPasswordExpiresAt');

  if (!user) return sendSuccess(res, genericResponse);

  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.resetPasswordExpiresAt = Date.now() + 30 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  const clientUrl = process.env.CLIENT_URL?.split(',')[0] || 'http://localhost:5173';
  const resetUrl = `${clientUrl.replace(/\/$/, '')}/reset-password/${resetToken}`;

  try {
    await sendPasswordResetEmail({ user, resetUrl });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiresAt = undefined;
    await user.save({ validateBeforeSave: false });
    if (process.env.NODE_ENV !== 'production') throw error;
  }

  return sendSuccess(res, genericResponse);
};

export const resetPassword = async (req, res) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpiresAt: { $gt: Date.now() },
    isActive: true
  }).select('+password +resetPasswordToken +resetPasswordExpiresAt');

  if (!user) throw new ApiError(400, 'Password reset token is invalid or has expired');

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpiresAt = undefined;
  await user.save();

  return res.json({
    success: true,
    message: 'Password reset successfully',
    token: generateToken(user),
    user: publicUser(user)
  });
};

export const changePassword = async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(req.body.currentPassword))) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  user.password = req.body.newPassword;
  await user.save();
  return sendSuccess(res, { message: 'Password changed successfully' });
};
