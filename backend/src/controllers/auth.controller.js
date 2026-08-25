import { getConfig } from '../config/env.js';
import {
  createSessionToken,
  getSessionSecret,
  safeEqual,
  SESSION_TTL_MS,
} from '../services/auth/session.js';
import { logger } from '../utils/logger.js';

/**
 * Username/password login for the dashboard. Issues a signed session token;
 * the password itself is never stored client-side and never logged.
 *
 * Brute-force protection: per-IP attempt throttle (in-memory; per instance).
 */

const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 60_000;
const attemptLog = new Map(); // ip -> timestamps

function allowAttempt(ip) {
  const now = Date.now();
  const recent = (attemptLog.get(ip) ?? []).filter((t) => now - t < ATTEMPT_WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) {
    attemptLog.set(ip, recent);
    return false;
  }
  recent.push(now);
  attemptLog.set(ip, recent);
  if (attemptLog.size > 10_000) {
    const oldest = attemptLog.keys().next().value;
    if (oldest !== undefined) attemptLog.delete(oldest);
  }
  return true;
}

export function createAuthController() {
  return {
    /** POST /api/auth/login  { username, password } -> { token, expiresAt } */
    async login(req, res) {
      const config = getConfig();
      if (!config.adminUsername || !config.adminPassword) {
        res.status(503).json({
          error: 'Password login is disabled. Set ADMIN_USERNAME and ADMIN_PASSWORD to enable it.',
        });
        return;
      }
      const ip = req.ip ?? 'unknown';
      if (!allowAttempt(ip)) {
        logger.warn('AUTH', 'Login attempt throttled');
        res.status(429).json({ error: 'Too many login attempts. Try again in a minute.' });
        return;
      }

      const { username, password } = req.body ?? {};
      const userOk = safeEqual(username, config.adminUsername);
      const passOk = safeEqual(password, config.adminPassword);
      if (!userOk || !passOk) {
        logger.warn('AUTH', 'Failed login attempt');
        res.status(401).json({ error: 'Invalid login ID or password.' });
        return;
      }

      const token = createSessionToken(config.adminUsername, getSessionSecret(config));
      logger.info('AUTH', 'Admin login succeeded');
      res.json({ token, expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
    },
  };
}
