import multer from 'multer';

export const notFound = (req, _res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

export const errorHandler = (err, _req, res, _next) => {
  if (res.headersSent) return _next(err);
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  if (err instanceof multer.MulterError) {
    statusCode = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file is too large' : err.message;
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `${field} already exists`;
  } else if (err.name === 'ValidationError') {
    statusCode = 422;
    details = Object.entries(err.errors).map(([field, error]) => ({ field, message: error.message }));
    message = 'Validation failed';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path || 'record identifier'}`;
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Request body contains invalid JSON';
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error(err.stack || err);
  }

  const payload = { success: false, message };
  if (details) payload.errors = details;
  if (process.env.NODE_ENV === 'development' && statusCode === 500) payload.stack = err.stack;

  return res.status(statusCode).json(payload);
};
