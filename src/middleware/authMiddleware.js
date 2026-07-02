import jwt from 'jsonwebtoken';
import User, { normalizeUserRole } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

export const protect = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authentication token is required');
    }

    const jwtSecret = process.env.JWT_SECRET || process.env.JWT_KEY;
    if (!jwtSecret) throw new Error('Missing JWT secret');

    const decoded = jwt.verify(header.slice(7), jwtSecret, {
      issuer: process.env.JWT_ISSUER || 'complete-crm-api',
      audience: process.env.JWT_AUDIENCE || 'complete-crm-client'
    });

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) throw new ApiError(401, 'User account is unavailable');

    let normalizedRole = normalizeUserRole(user.role);
    if (normalizedRole === 'admin' && !(await User.exists({ role: 'superadmin' }))) {
      normalizedRole = 'superadmin';
    }
    if (normalizedRole !== user.role) {
      user.role = normalizedRole;
      await user.save({ validateBeforeSave: false });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    if (error.name === 'TokenExpiredError') return next(new ApiError(401, 'Authentication token has expired'));
    if (error.name === 'JsonWebTokenError') return next(new ApiError(401, 'Authentication token is invalid'));
    return next(error);
  }
};

export const optionalAuth = async (req, _res, next) => {
  if (!req.headers.authorization) return next();
  return protect(req, _res, next);
};
