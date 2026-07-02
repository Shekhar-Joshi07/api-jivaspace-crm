const requiredInProduction = ['MONGO_URI', 'JWT_SECRET', 'CLIENT_URL'];

export const validateEnvironment = () => {
  const missing = requiredInProduction.filter(key => !process.env[key]);
  if (process.env.NODE_ENV === 'production' && missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const jwtSecret = process.env.JWT_SECRET || process.env.JWT_KEY;
  if (!jwtSecret) throw new Error('Set JWT_SECRET in server/.env');
  if (jwtSecret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be at least 32 characters');
    }
    console.warn('Warning: use a JWT_SECRET with at least 32 characters before deployment.');
  }
  if (!process.env.MONGO_URI && !process.env.DB_URL) throw new Error('Set MONGO_URI in server/.env');
};
