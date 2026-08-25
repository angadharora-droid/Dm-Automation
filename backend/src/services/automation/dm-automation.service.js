import { logger } from '../../utils/logger.js';
import { MetaApiError } from '../meta/meta-api.service.js';

/**
 * Handles `messages` webhook events: echo/self guards, dedup, reply
 * generation (pluggable — see reply-generator.js), throttling, and sending.
 *
 * @param deps {{ instagram, idempotency, throttle, generator, selfAccountId?, activity? }}
 */
export class DmAutomationService {
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * @param event one webhook `entry[].messaging[]` element:
   *   { sender: {id}, recipient: {id}, timestamp, message?: {mid, text, is_echo, attachments} }
   */
  async handleMessagingEvent(event) {
    const message = event.message;
    if (!message) {
      logger.debug('MESSAGE', 'Ignoring non-message messaging event (seen/reaction/postback)');
      return;
    }
    // Loop protection layer 1: message_echoes deliver our own outbound
    // messages back to the webhook with is_echo set.
    if (message.is_echo) {
      logger.debug('MESSAGE', 'Skipping echo of own outbound message');
      return;
    }
    const senderId = event.sender?.id;
    if (!senderId) {
      logger.warn('MESSAGE', 'Message event without sender id ignored');
      return;
    }
    // Loop protection layer 2: never reply to messages sent by our own account.
    if (this.deps.selfAccountId && senderId === this.deps.selfAccountId) {
      logger.debug('MESSAGE', 'Skipping message sent by own account (loop protection)');
      return;
    }

    // Do not log DM text or sender IDs at info level — message content is private.
    logger.info('MESSAGE', 'DM received', { mid: message.mid });
    this.deps.activity?.increment('messagesReceived');

    const text = message.text;
    if (!text) {
      logger.debug('MESSAGE', 'Message has no text (attachment/share); no automation applied');
      return;
    }

    const dedupKey = message.mid
      ? `message:${message.mid}`
      : `message:${senderId}:${event.timestamp ?? 'no-ts'}:${text.length}`;
    if (!(await this.deps.idempotency.markIfNew(dedupKey))) {
      logger.debug('MESSAGE', 'Duplicate message event skipped', { mid: message.mid });
      this.deps.activity?.increment('duplicatesSkipped');
      return;
    }

    const reply = await this.deps.generator.generateReply({
      channel: 'dm',
      text,
      senderId,
    });
    if (!reply) {
      logger.debug('AUTOMATION', 'No reply generated for DM; staying silent');
      return;
    }

    if (!this.deps.throttle.allow(senderId)) {
      logger.warn('AUTOMATION', 'DM reply throttled for user', { mid: message.mid });
      return;
    }

    try {
      await this.deps.instagram.sendTextMessage(senderId, reply);
      logger.info('MESSAGE', 'Response sent', { mid: message.mid });
      this.deps.activity?.increment('dmsSent');
      this.deps.activity?.record('message', 'Automated DM reply sent', { mid: message.mid });
    } catch (err) {
      this.deps.activity?.increment('errors');
      this.deps.activity?.record('error', 'Failed to send DM reply', { mid: message.mid });
      if (err instanceof MetaApiError) {
        // Expected failures include the 24-hour messaging window having closed.
        logger.error('AUTOMATION', `Failed to send DM reply: ${err.message}`, {
          mid: message.mid,
          status: err.status,
          code: err.graphError?.code,
        });
      } else {
        logger.error('AUTOMATION', `Failed to send DM reply: ${err.message}`, {
          mid: message.mid,
        });
      }
    }
  }
}
