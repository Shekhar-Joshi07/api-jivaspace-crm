import 'dotenv/config';
import mongoose from './config/mongoose.js';
import app from './app.js';
import { connectDB } from './config/db.js';
import { validateEnvironment } from './config/env.js';

const port = Number(process.env.PORT || 5000);
let server;

const shutdown = async signal => {
  console.log(`${signal} received. Shutting down gracefully.`);
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
  await mongoose.connection.close();
  process.exit(0);
};

try {
  validateEnvironment();
  await connectDB();
  server = app.listen(port, () => {
    console.log(`Complete CRM API listening on http://localhost:${port}`);
  });

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
} catch (error) {
  console.error('Server failed to start:', error.message);
  process.exit(1);
}

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
  if (server) server.close(() => process.exit(1));
  else process.exit(1);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});
