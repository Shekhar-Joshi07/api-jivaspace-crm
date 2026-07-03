import mongoose from './mongoose.js';

export const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.DB_URL;
  if (!mongoUri) {
    throw new Error('Missing MongoDB connection string. Set MONGO_URI in server/.env.');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000)
  });
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
};
