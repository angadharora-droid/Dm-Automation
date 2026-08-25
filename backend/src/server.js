import { createApp, createDefaultServices } from './app.js';
import { getConfig, missingCriticalConfig } from './config/env.js';
import { connectMongo } from './services/db/mongo.js';
import { logger } from './utils/logger.js';

const config = getConfig();

const missing = missingCriticalConfig(config);
if (missing.length > 0) {
  logger.warn(
    'CONFIG',
    `Missing environment variables: ${missing.join(', ')}. ` +
      'The server will start, but webhook validation and Meta API calls need them.',
  );
}

const mongo = await connectMongo(config);
const services = await createDefaultServices({ mongo });
const app = createApp(services);

const server = app.listen(config.port, '0.0.0.0', () => {
  logger.info('SERVER', `Listening on port ${config.port} (${config.nodeEnv})`);
  logger.info(
    'SERVER',
    `Webhook endpoint: /webhooks/instagram | Meta API ${config.metaApiVersion} via ${config.metaGraphBaseUrl} | storage: ${mongo ? 'MongoDB' : 'in-memory'}`,
  );
});

function shutdown(signal) {
  logger.info('SERVER', `${signal} received; shutting down gracefully`);
  server.close(() => {
    const closeDb = mongo ? mongo.client.close().catch(() => {}) : Promise.resolve();
    closeDb.finally(() => process.exit(0));
  });
  // Force-exit if connections refuse to drain.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
