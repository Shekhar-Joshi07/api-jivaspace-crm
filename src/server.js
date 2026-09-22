import 'dotenv/config';
import mongoose from './config/mongoose.js';
import app from './app.js';
import { connectDB } from './config/db.js';
import { validateEnvironment } from './config/env.js';

const port = Number(process.env.PORT || 5000);
// Managed hosts route traffic through a container network, so listen on every
// interface rather than relying on the platform-specific Node default.
const host = process.env.HOST || '0.0.0.0';
let server;
let reconnectTimer;

const connectDatabaseInBackground = async () => {
  app.locals.databaseStatus = 'connecting';

  try {
    await connectDB();
    app.locals.databaseStatus = 'connected';
  } catch (error) {
    app.locals.databaseStatus = 'unavailable';
    console.error('MongoDB connection failed:', error.message);

    // Keep the web process available for health checks while retrying a
    // temporarily unavailable managed database connection.
    reconnectTimer = setTimeout(() => {
      void connectDatabaseInBackground();
    }, 30_000);
  }
};

const shutdown = async signal => {
  console.log(`${signal} received. Shutting down gracefully.`);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
  await mongoose.connection.close();
  process.exit(0);
};

try {
  console.log(`Starting Complete CRM API on ${host}:${port}`);
  validateEnvironment();
  console.log('Environment validation completed. Opening HTTP server...');
  server = app.listen(port, host, () => {
    console.log(`Complete CRM API listening on http://${host}:${port}`);
  });
  console.log('Connecting to MongoDB in the background...');
  void connectDatabaseInBackground();

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
