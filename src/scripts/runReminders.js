import dotenv from 'dotenv';
import mongoose from '../config/mongoose.js';
import { connectDB } from '../config/db.js';
import { generateReminders } from '../services/reminderService.js';

dotenv.config();

try {
  await connectDB();
  const result = await generateReminders();
  console.log('Reminder job completed:', result);
} catch (error) {
  console.error('Reminder job failed:', error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
