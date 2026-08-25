import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { logger } from '../../utils/logger.js';

/**
 * Stateless admin sessions: HMAC-signed tokens ("payloadB64url.signature")
 * issued after a successful username/password login. No token store needed —
 * any instance with the same secret can verify them.
 */

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

let ephemeralSecret;

/**
 * Secret used to sign session tokens: SESSION_SECRET, else derived from
 * META_APP_SECRET, else a per-boot random value (sessions then die on
 * restart — logged so it isn't a mystery).
 */
export function getSessionSecret(config) {
  if (config.sessionSecret) return config.sessionSecret;
  if (config.metaAppSecret) return `session:${config.metaAppSecret}`;
  if (!ephemeralSecret) {
    ephemeralSecret = randomBytes(32).toString('hex');
    logger.warn(
      'AUTH',
      'No SESSION_SECRET or META_APP_SECRET set; using a per-boot session secret (logins reset on restart)',
    );
  }
  return ephemeralSecret;
}

function sign(data, secret) {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

/** Constant-time string comparison that never throws on length mismatch. */
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''));
  const bufB = Buffer.from(String(b ?? ''));
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA); // burn comparable time
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function createSessionToken(username, secret, ttlMs = SESSION_TTL_MS) {
  const payload = Buffer.from(
    JSON.stringify({ u: username, exp: Date.now() + ttlMs }),
  ).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns { username } for a valid unexpired token, otherwise null. */
export function verifySessionToken(token, secret) {
  if (typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!safeEqual(signature, sign(payload, secret))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return { username: data.u };
  } catch {
    return null;
  }
}
