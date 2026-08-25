import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { getConfig } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Instagram webhook handling (Instagram API with Instagram Login).
 *
 * Payload shapes verified against:
 * - https://developers.facebook.com/docs/instagram-platform/webhooks
 * - https://developers.facebook.com/docs/graph-api/webhooks/reference/instagram
 *
 * Comment events arrive as `entry[].changes[]` with `field: "comments"`;
 * message events arrive as `entry[].messaging[]` (Messenger-style envelope).
 */

/**
 * GET verification handshake.
 * Meta sends hub.mode=subscribe, hub.verify_token, hub.challenge; we must echo
 * the challenge only when the token matches META_VERIFY_TOKEN.
 */
export function verifyWebhook(req, res) {
  const config = getConfig();
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (
    mode === 'subscribe' &&
    config.metaVerifyToken !== undefined &&
    token === config.metaVerifyToken &&
    typeof challenge === 'string'
  ) {
    logger.info('WEBHOOK', 'Webhook verification succeeded');
    res.status(200).type('text/plain').send(challenge);
    return;
  }
  logger.warn('WEBHOOK', 'Webhook verification failed (mode/token mismatch)');
  res.sendStatus(403);
}

/**
 * Validates X-Hub-Signature-256: "sha256=" + HMAC-SHA256(raw body, app secret).
 */
export function isValidSignature(rawBody, signatureHeader, appSecret) {
  if (!rawBody || !signatureHeader?.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  const received = Buffer.from(signatureHeader);
  const computed = Buffer.from(expected);
  return received.length === computed.length && timingSafeEqual(received, computed);
}

export function createReceiveWebhookHandler(deps) {
  return (req, res) => {
    const config = getConfig();
    if (!config.metaAppSecret) {
      logger.error(
        'WEBHOOK',
        'META_APP_SECRET is not configured; rejecting webhook (signature cannot be validated)',
      );
      res.sendStatus(401);
      return;
    }

    const signature = req.header('x-hub-signature-256');
    if (!isValidSignature(req.rawBody, signature, config.metaAppSecret)) {
      logger.warn('WEBHOOK', 'Invalid webhook signature; request rejected');
      res.sendStatus(401);
      return;
    }

    // Acknowledge immediately — Meta retries deliveries that respond slowly —
    // then process the events asynchronously.
    res.sendStatus(200);
    const payload = req.body;
    setImmediate(() => {
      processWebhookPayload(payload, deps).catch((err) => {
        logger.error('WEBHOOK', `Unhandled error processing webhook: ${err.message}`);
      });
    });
  };
}

export async function processWebhookPayload(payload, deps) {
  if (!payload || !Array.isArray(payload.entry)) {
    logger.warn('WEBHOOK', 'Webhook payload without entry array ignored');
    return;
  }
  logger.info('WEBHOOK', 'Instagram event received', {
    object: payload.object,
    entries: payload.entry.length,
  });
  deps.activity?.increment('webhooksReceived');
  deps.activity?.record('webhook', 'Instagram webhook received', {
    object: payload.object,
    entries: payload.entry.length,
  });

  for (const entry of payload.entry) {
    if (Array.isArray(entry.messaging)) {
      for (const messagingEvent of entry.messaging) {
        await deps.dmAutomation.handleMessagingEvent(messagingEvent);
      }
    }
    if (Array.isArray(entry.changes)) {
      for (const change of entry.changes) {
        if (change.field === 'comments') {
          await deps.commentAutomation.handleCommentEvent(change.value ?? {});
        } else {
          logger.info('WEBHOOK', `Unhandled webhook field "${change.field ?? 'unknown'}" ignored`);
        }
      }
    }
    if (!entry.messaging && !entry.changes) {
      logger.debug('WEBHOOK', 'Webhook entry with no messaging/changes ignored');
    }
  }
}
