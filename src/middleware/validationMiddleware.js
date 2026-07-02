import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';

export const validateRequest = (req, _res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = result.array().map(error => ({
    field: error.path,
    message: error.msg,
    value: error.value
  }));

  return next(new ApiError(422, 'Validation failed', details));
};
