import { getConfig } from '../config/env.js';
import { getSessionSecret, safeEqual, verifySessionToken } from '../services/auth/session.js';
import { MetaApiError } from '../services/meta/meta-api.service.js';
import { logger } from '../utils/logger.js';

/**
 * Admin auth guard for dashboard/helper endpoints. Accepts either:
 * - the ADMIN_API_KEY via the x-admin-key header (scripts, curl), or
 * - a session token from POST /api/auth/login via Authorization: Bearer
 *   (dashboard username/password sign-in).
 * Disabled entirely (503) when neither auth method is configured.
 * Responses never include tokens or internal error details.
 */
export function requireAdminKey(req, res) {
  const config = getConfig();
  const passwordLoginEnabled = Boolean(config.adminUsername && config.adminPassword);
  if (!config.adminApiKey && !passwordLoginEnabled) {
    res.status(503).json({
      error:
        'Admin endpoints are disabled. Set ADMIN_API_KEY and/or ADMIN_USERNAME + ADMIN_PASSWORD.',
    });
    return false;
  }

  const apiKey = req.header('x-admin-key');
  if (config.adminApiKey && apiKey && safeEqual(apiKey, config.adminApiKey)) {
    return true;
  }

  const authorization = req.header('authorization');
  if (passwordLoginEnabled && authorization?.startsWith('Bearer ')) {
    const session = verifySessionToken(authorization.slice(7), getSessionSecret(config));
    if (session) return true;
  }

  res.status(401).json({ error: 'Unauthorized' });
  return false;
}

export function createInstagramController(instagram) {
  return {
    /** GET /api/instagram/account — proves the access token works. */
    async getAccount(req, res) {
      if (!requireAdminKey(req, res)) return;
      try {
        const info = await instagram.getAccountInfo();
        res.json(info);
      } catch (err) {
        logMetaError('Failed to fetch account info', err);
        res.status(502).json({ error: 'Failed to fetch account info from the Meta API' });
      }
    },

    /**
     * POST /api/instagram/subscribe — one-time setup step that enables webhook
     * delivery for the connected account (POST /<IG_ID>/subscribed_apps).
     */
    async subscribeWebhooks(req, res) {
      if (!requireAdminKey(req, res)) return;
      try {
        const result = await instagram.subscribeToWebhookFields(['comments', 'messages']);
        res.json(result);
      } catch (err) {
        logMetaError('Failed to subscribe account to webhook fields', err);
        res.status(502).json({ error: 'Failed to subscribe to webhook fields via the Meta API' });
      }
    },
  };
}

function logMetaError(context, err) {
  if (err instanceof MetaApiError) {
    logger.error('META', `${context}: ${err.message}`, {
      status: err.status,
      code: err.graphError?.code,
    });
  } else {
    logger.error('META', `${context}: ${err.message}`);
  }
}
