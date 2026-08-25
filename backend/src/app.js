import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { loadAutomationConfig } from './config/automation.config.js';
import { getConfig } from './config/env.js';
import { createDashboardRouter } from './routes/dashboard.routes.js';
import { createHealthRouter } from './routes/health.routes.js';
import { createInstagramRouter } from './routes/instagram.routes.js';
import { createWebhookRouter } from './routes/webhook.routes.js';
import { CommentAutomationService } from './services/automation/comment-automation.service.js';
import { DmAutomationService } from './services/automation/dm-automation.service.js';
import { RuleBasedReplyGenerator } from './services/automation/reply-generator.js';
import { MongoActivityLog } from './services/db/mongo-activity-log.js';
import { MongoIdempotencyStore } from './services/db/mongo-idempotency.store.js';
import { ActivityLog } from './services/events/activity-log.js';
import { InMemoryIdempotencyStore } from './services/events/idempotency.js';
import { ReplyThrottle } from './services/events/reply-throttle.js';
import { InstagramService } from './services/meta/instagram.service.js';
import { MetaApiClient } from './services/meta/meta-api.service.js';
import { logger } from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Composition root. Swapping any piece (AI reply generator, per-campaign
 * rules from MongoDB) happens here without touching the webhook or Meta
 * integration code.
 *
 * @param {{mongo?: {client, db}|null}} [options] pass the result of
 *   connectMongo() to enable MongoDB-backed stores; omit/null = in-memory.
 */
export async function createDefaultServices({ mongo } = {}) {
  const config = getConfig();
  const automationConfig = loadAutomationConfig();

  let idempotency;
  let activity;
  if (mongo?.db) {
    idempotency = await new MongoIdempotencyStore(mongo.db).init();
    activity = await new MongoActivityLog(mongo.db).init();
  } else {
    idempotency = new InMemoryIdempotencyStore();
    activity = new ActivityLog();
  }

  const apiClient = new MetaApiClient({
    baseUrl: config.metaGraphBaseUrl,
    apiVersion: config.metaApiVersion,
    accessToken: config.instagramAccessToken,
    timeoutMs: config.requestTimeoutMs,
  });
  const instagramService = new InstagramService(apiClient, config.instagramAccountId);

  const throttle = new ReplyThrottle();
  const generator = new RuleBasedReplyGenerator(automationConfig);

  return {
    instagramService,
    activity,
    automationConfig,
    databaseConnected: Boolean(mongo?.db),
    commentAutomation: new CommentAutomationService({
      instagram: instagramService,
      idempotency,
      throttle,
      config: automationConfig,
      selfAccountId: config.instagramAccountId,
      activity,
    }),
    dmAutomation: new DmAutomationService({
      instagram: instagramService,
      idempotency,
      throttle,
      generator,
      selfAccountId: config.instagramAccountId,
      activity,
    }),
  };
}

export function createApp(services) {
  const config = getConfig();
  const app = express();

  app.set('trust proxy', 1); // Railway terminates TLS in front of the app
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.allowedOrigins.length > 0 ? config.allowedOrigins : false }));
  app.use(
    express.json({
      limit: config.webhookBodyLimit,
      verify: (req, _res, buf) => {
        // Raw body is required for X-Hub-Signature-256 validation.
        req.rawBody = buf;
      },
    }),
  );

  app.use(createHealthRouter());
  app.use('/webhooks', createWebhookRouter(services));
  app.use('/api/instagram', createInstagramRouter(services.instagramService));
  app.use(
    '/api/dashboard',
    createDashboardRouter({
      activity: services.activity,
      automationConfig: services.automationConfig,
      databaseConnected: services.databaseConnected,
    }),
  );

  // React admin dashboard (built with Vite into <repo>/frontend/dist). Data
  // endpoints are admin-key protected; the static shell contains no secrets.
  // FRONTEND_DIR overrides the location for separate hosting setups.
  const frontendDir = config.frontendDir ?? path.join(__dirname, '..', '..', 'frontend', 'dist');
  app.use('/dashboard', express.static(frontendDir, { index: 'index.html' }));

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err, _req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const status = typeof err.status === 'number' ? err.status : 500;
    const message = err.message ?? 'unknown error';
    if (status >= 500) logger.error('HTTP', `Unhandled error: ${message}`);
    else logger.warn('HTTP', `Request error (${status}): ${message}`);
    // Never leak internal error details to clients.
    res.status(status).json({ error: status >= 500 ? 'Internal server error' : 'Bad request' });
  });

  return app;
}
