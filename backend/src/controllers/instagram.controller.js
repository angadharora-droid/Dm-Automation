import { getConfig } from '../config/env.js';
import { MetaApiError } from '../services/meta/meta-api.service.js';
import { logger } from '../utils/logger.js';

/**
 * Admin helper endpoints for setup and troubleshooting. Gated behind
 * ADMIN_API_KEY (x-admin-key header); disabled entirely when the key is unset.
 * Responses never include tokens or internal error details.
 */

export function requireAdminKey(req, res) {
  const config = getConfig();
  if (!config.adminApiKey) {
    res
      .status(503)
      .json({ error: 'Admin endpoints are disabled. Set ADMIN_API_KEY to enable them.' });
    return false;
  }
  if (req.header('x-admin-key') !== config.adminApiKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
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
