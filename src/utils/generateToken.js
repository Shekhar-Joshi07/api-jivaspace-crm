import jwt from 'jsonwebtoken';

export const generateToken = (user) => {
  const jwtSecret = process.env.JWT_SECRET || process.env.JWT_KEY;

  if (!jwtSecret) {
    throw new Error('Missing JWT secret. Set JWT_SECRET or JWT_KEY in server/.env.');
  }

  return jwt.sign(
    { id: user._id, role: user.role },
    jwtSecret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: process.env.JWT_ISSUER || 'complete-crm-api',
      audience: process.env.JWT_AUDIENCE || 'complete-crm-client'
    }
  );
};
