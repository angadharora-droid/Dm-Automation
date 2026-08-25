import { logger } from '../../utils/logger.js';
import { MetaApiError } from '../meta/meta-api.service.js';
import { renderTemplate, templateNeedsProfile } from './template.js';

const PROFILE_CACHE_TTL_MS = 60 * 60 * 1000;
const PROFILE_CACHE_MAX = 5000;

/**
 * Handles `messages` webhook events: echo/self guards, dedup, reply
 * generation (pluggable — see reply-generator.js), throttling, and sending.
 *
 * Replies containing {username}/{name} placeholders trigger a profile lookup
 * for the sender (allowed by Meta since the user has messaged the account),
 * cached per sender for an hour.
 *
 * @param deps {{ instagram, idempotency, throttle, generator, selfAccountId?, activity? }}
 */
export class DmAutomationService {
  constructor(deps) {
    this.deps = deps;
    /** IGSID -> { username, name, at } */
    this.profileCache = new Map();
  }

  async lookupProfile(senderId) {
    const cached = this.profileCache.get(senderId);
    if (cached && Date.now() - cached.at < PROFILE_CACHE_TTL_MS) return cached;
    try {
      const profile = await this.deps.instagram.getUserProfile(senderId);
      const entry = { username: profile?.username, name: profile?.name, at: Date.now() };
      this.profileCache.set(senderId, entry);
      if (this.profileCache.size > PROFILE_CACHE_MAX) {
        const oldest = this.profileCache.keys().next().value;
        if (oldest !== undefined) this.profileCache.delete(oldest);
      }
      return entry;
    } catch (err) {
      logger.warn('AUTOMATION', `Could not fetch sender profile: ${err.message}`);
      return { username: undefined, name: undefined, at: Date.now() };
    }
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

    const generated = await this.deps.generator.generateReply({
      channel: 'dm',
      text,
      senderId,
    });
    if (!generated) {
      logger.debug('AUTOMATION', 'No reply generated for DM; staying silent');
      return;
    }
    // Generators may return a plain string or { text?, button? }.
    const reply = typeof generated === 'string' ? { text: generated } : generated;
    if (!reply.text && !reply.button) {
      logger.debug('AUTOMATION', 'Empty reply generated for DM; staying silent');
      return;
    }

    // Personalize: only pay for the profile lookup when a template needs it.
    let profile;
    const needsProfile =
      templateNeedsProfile(reply.text) || templateNeedsProfile(reply.button?.header);
    if (needsProfile) profile = await this.lookupProfile(senderId);
    const renderedText = reply.text ? renderTemplate(reply.text, profile ?? {}) : undefined;
    const renderedHeader = reply.button?.header
      ? renderTemplate(reply.button.header, profile ?? {})
      : undefined;

    if (!this.deps.throttle.allow(senderId)) {
      logger.warn('AUTOMATION', 'DM reply throttled for user', { mid: message.mid });
      return;
    }

    try {
      if (renderedText) {
        await this.deps.instagram.sendTextMessage(senderId, renderedText);
      }
      if (reply.button) {
        await this.deps.instagram.sendButtonTemplate(senderId, {
          header: renderedHeader ?? reply.button.title,
          buttonTitle: reply.button.title,
          buttonUrl: reply.button.url,
        });
      }
      logger.info('MESSAGE', 'Response sent', {
        mid: message.mid,
        withButton: Boolean(reply.button),
      });
      this.deps.activity?.increment('dmsSent');
      this.deps.activity?.record('message', 'Automated DM reply sent', {
        mid: message.mid,
        withButton: Boolean(reply.button),
      });
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
