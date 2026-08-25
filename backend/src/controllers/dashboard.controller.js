import { getConfig, missingCriticalConfig } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { requireAdminKey } from './instagram.controller.js';

/**
 * JSON API backing the React admin dashboard.
 * All endpoints require the x-admin-key header. Config status is reported as
 * booleans only — secret values never leave the server. Works with both the
 * Mongo-backed and in-memory activity log (results are awaited either way).
 */
export function createDashboardController(deps) {
  return {
    /** GET /api/dashboard/overview */
    async overview(req, res) {
      if (!requireAdminKey(req, res)) return;
      const config = getConfig();
      try {
        const counters = await deps.activity.getCounters();
        res.json({
          status: 'ok',
          startedAt: deps.activity.startedAt,
          nodeEnv: config.nodeEnv,
          metaApiVersion: config.metaApiVersion,
          database: deps.databaseConnected ? 'mongodb' : 'in-memory',
          configured: {
            metaAppSecret: Boolean(config.metaAppSecret),
            metaVerifyToken: Boolean(config.metaVerifyToken),
            instagramAccessToken: Boolean(config.instagramAccessToken),
            instagramAccountId: Boolean(config.instagramAccountId),
            mongodb: Boolean(deps.databaseConnected),
          },
          missingConfig: missingCriticalConfig(config),
          counters,
        });
      } catch (err) {
        logger.error('DASHBOARD', `Failed to load overview: ${err.message}`);
        res.status(500).json({ error: 'Failed to load overview' });
      }
    },

    /** GET /api/dashboard/activity */
    async activity(req, res) {
      if (!requireAdminKey(req, res)) return;
      const limitRaw = Number.parseInt(String(req.query.limit ?? ''), 10);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
      try {
        const entries = await deps.activity.getEntries(limit);
        res.json({ entries });
      } catch (err) {
        logger.error('DASHBOARD', `Failed to load activity: ${err.message}`);
        res.status(500).json({ error: 'Failed to load activity' });
      }
    },

    /** GET /api/dashboard/rules */
    rules(req, res) {
      if (!requireAdminKey(req, res)) return;
      res.json({
        commentRules: deps.automationConfig.commentRules,
        dmRules: deps.automationConfig.dmRules,
        dmFallbackReply: deps.automationConfig.dmFallbackReply,
      });
    },
  };
}
