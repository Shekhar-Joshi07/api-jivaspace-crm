import { httpServerHandler } from 'cloudflare:node';
import { env as workerEnv } from 'cloudflare:workers';

const port = 3000;
const handler = httpServerHandler({ port });
let startupPromise;

const envKeys = [
  'MONGO_URI',
  'DB_URL',
  'JWT_SECRET',
  'JWT_KEY',
  'JWT_EXPIRES_IN',
  'JWT_ISSUER',
  'JWT_AUDIENCE',
  'CLIENT_URL',
  'MAX_FILE_SIZE_MB',
  'MONGO_SERVER_SELECTION_TIMEOUT_MS',
  'EMAIL_FROM',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'SMS_API_URL',
  'SMS_API_KEY',
  'SMS_SENDER_ID'
];

const copyEnv = source => {
  for (const key of envKeys) {
    if (source?.[key] !== undefined && source[key] !== null && source[key] !== '') {
      process.env[key] = String(source[key]);
    }
  }
  process.env.PORT = String(port);
};

const startApp = async runtimeEnv => {
  copyEnv(workerEnv);
  copyEnv(runtimeEnv);

  const [{ default: app }, { connectDB }, { validateEnvironment }] = await Promise.all([
    import('./app.js'),
    import('./config/db.js'),
    import('./config/env.js')
  ]);

  validateEnvironment();
  await connectDB();
  app.listen(port);
};

export default {
  async fetch(request, env, ctx) {
    startupPromise ??= startApp(env);
    await startupPromise;
    return handler.fetch(request, env, ctx);
  }
};
