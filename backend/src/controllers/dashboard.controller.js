import { validateAutomationConfig } from '../config/automation.config.js';
import { getConfig, missingCriticalConfig } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { requireAdminKey } from './instagram.controller.js';

/**
 * JSON API backing the React admin dashboard.
 * All endpoints require the x-admin-key header. Config status is reported as
 * booleans only — secret values never leave the server. Works with both the
 * Mongo-backed and in-memory activity log (results are awaited either way).
 */
const POSTS_CACHE_MS = 60_000;

export function createDashboardController(deps) {
  let postsCache = null; // { at, data }

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

    /**
     * GET /api/dashboard/posts — recent Instagram posts with their IDs (for
     * scoping rules to specific posts). Cached for 60s to spare Meta rate
     * limits while the dashboard is open.
     */
    async posts(req, res) {
      if (!requireAdminKey(req, res)) return;
      if (postsCache && Date.now() - postsCache.at < POSTS_CACHE_MS) {
        res.json({ posts: postsCache.data, cached: true });
        return;
      }
      try {
        const result = await deps.instagram.getRecentMedia(24);
        const posts = (result?.data ?? []).map((media) => ({
          id: media.id,
          caption: media.caption ?? '',
          mediaType: media.media_type,
          mediaUrl: media.media_url,
          thumbnailUrl: media.thumbnail_url,
          permalink: media.permalink,
          timestamp: media.timestamp,
          likeCount: media.like_count,
          commentsCount: media.comments_count,
        }));
        postsCache = { at: Date.now(), data: posts };
        res.json({ posts, cached: false });
      } catch (err) {
        logger.error('DASHBOARD', `Failed to load posts: ${err.message}`);
        res.status(502).json({ error: 'Failed to load posts from the Meta API' });
      }
    },

    /** GET /api/dashboard/analytics?days=14 — per-day event counts. */
    async analytics(req, res) {
      if (!requireAdminKey(req, res)) return;
      const daysRaw = Number.parseInt(String(req.query.days ?? ''), 10);
      const days = Number.isFinite(daysRaw) ? Math.min(Math.max(daysRaw, 1), 30) : 14;
      try {
        const daily = await deps.activity.getDailyStats(days);
        res.json({ days: daily, totals: await deps.activity.getCounters() });
      } catch (err) {
        logger.error('DASHBOARD', `Failed to load analytics: ${err.message}`);
        res.status(500).json({ error: 'Failed to load analytics' });
      }
    },

    /** GET /api/dashboard/rules */
    async rules(req, res) {
      if (!requireAdminKey(req, res)) return;
      try {
        const config = await deps.ruleStore.getConfig();
        res.json({
          commentRules: config.commentRules,
          dmRules: config.dmRules,
          dmFallbackReply: config.dmFallbackReply,
        });
      } catch (err) {
        logger.error('DASHBOARD', `Failed to load rules: ${err.message}`);
        res.status(500).json({ error: 'Failed to load rules' });
      }
    },

    /** PUT /api/dashboard/rules — full config from the dashboard editor. */
    async updateRules(req, res) {
      if (!requireAdminKey(req, res)) return;
      const { config, errors } = validateAutomationConfig(req.body);
      if (errors.length > 0) {
        res.status(400).json({ error: 'Invalid rules', details: errors });
        return;
      }
      try {
        const saved = await deps.ruleStore.setConfig(config);
        logger.info('AUTOMATION', 'Automation rules updated from dashboard', {
          commentRules: saved.commentRules.length,
          dmRules: saved.dmRules.length,
        });
        res.json({
          commentRules: saved.commentRules,
          dmRules: saved.dmRules,
          dmFallbackReply: saved.dmFallbackReply,
        });
      } catch (err) {
        logger.error('DASHBOARD', `Failed to save rules: ${err.message}`);
        res.status(500).json({ error: 'Failed to save rules' });
      }
    },
  };
}
