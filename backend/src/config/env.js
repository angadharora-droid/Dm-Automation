import { config as loadDotenv } from 'dotenv';

loadDotenv({ quiet: true });

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function emptyToUndefined(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Reads configuration from process.env on every call so tests (and future
 * multi-tenant setups) can change the environment without module reloads.
 */
export function getConfig() {
  const env = process.env;
  return {
    port: parsePositiveInt(env.PORT, 3000),
    nodeEnv: env.NODE_ENV ?? 'development',
    metaAppId: emptyToUndefined(env.META_APP_ID),
    metaAppSecret: emptyToUndefined(env.META_APP_SECRET),
    metaVerifyToken: emptyToUndefined(env.META_VERIFY_TOKEN),
    instagramAccessToken: emptyToUndefined(env.INSTAGRAM_ACCESS_TOKEN),
    instagramAccountId: emptyToUndefined(env.INSTAGRAM_ACCOUNT_ID),
    metaApiVersion: emptyToUndefined(env.META_API_VERSION) ?? 'v25.0',
    metaGraphBaseUrl: (emptyToUndefined(env.META_GRAPH_BASE_URL) ?? 'https://graph.instagram.com').replace(
      /\/+$/,
      '',
    ),
    adminApiKey: emptyToUndefined(env.ADMIN_API_KEY),
    adminUsername: emptyToUndefined(env.ADMIN_USERNAME),
    adminPassword: emptyToUndefined(env.ADMIN_PASSWORD),
    sessionSecret: emptyToUndefined(env.SESSION_SECRET),
    /** MongoDB connection string; unset = in-memory fallback stores. */
    mongodbUri: emptyToUndefined(env.MONGODB_URI),
    mongodbDbName: emptyToUndefined(env.MONGODB_DB) ?? 'instagram_automation',
    /** Path to the built frontend; default: sibling ../frontend/dist folder. */
    frontendDir: emptyToUndefined(env.FRONTEND_DIR),
    requestTimeoutMs: parsePositiveInt(env.REQUEST_TIMEOUT_MS, 10_000),
    webhookBodyLimit: emptyToUndefined(env.WEBHOOK_BODY_LIMIT) ?? '1mb',
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    logLevel: emptyToUndefined(env.LOG_LEVEL) ?? 'info',
  };
}

/**
 * Names of environment variables that must be set before the Meta integration
 * can work end-to-end. The server still boots without them (so the health
 * endpoint works on a fresh Railway deploy), but webhook validation and
 * outbound API calls will be disabled/failing until they are provided.
 */
export function missingCriticalConfig(config = getConfig()) {
  const missing = [];
  if (!config.metaAppSecret) missing.push('META_APP_SECRET');
  if (!config.metaVerifyToken) missing.push('META_VERIFY_TOKEN');
  if (!config.instagramAccessToken) missing.push('INSTAGRAM_ACCESS_TOKEN');
  if (!config.instagramAccountId) missing.push('INSTAGRAM_ACCOUNT_ID');
  return missing;
}
