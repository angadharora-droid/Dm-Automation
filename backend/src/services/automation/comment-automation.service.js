import { logger } from '../../utils/logger.js';
import { MetaApiError } from '../meta/meta-api.service.js';
import { findMatchingRule } from './keyword-matcher.js';

/**
 * Handles `comments` webhook events: dedup, loop guards, keyword matching,
 * and the private-reply / public-reply actions.
 *
 * @param deps {{ instagram, idempotency, throttle, config, selfAccountId?, activity? }}
 */
export class CommentAutomationService {
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * @param value the webhook `changes[].value` for field "comments":
   *   { id, from: {id, username}, media: {id, media_product_type}, parent_id?, text }
   */
  async handleCommentEvent(value) {
    const commentId = value?.id;
    if (!commentId) {
      logger.warn('COMMENT', 'Comment event without id ignored');
      return;
    }
    const text = value.text ?? '';
    const fromId = value.from?.id;

    logger.info('COMMENT', 'Comment received', {
      commentId,
      mediaId: value.media?.id,
      username: value.from?.username,
    });
    this.deps.activity?.increment('commentsReceived');

    // Loop protection layer 1: never react to our own account's comments.
    if (this.deps.selfAccountId && fromId === this.deps.selfAccountId) {
      logger.debug('COMMENT', 'Skipping comment from own account (loop protection)', { commentId });
      return;
    }
    // Loop protection layer 2: never react to text that IS one of our
    // configured public replies (covers webhook `from.id` edge cases).
    if (
      this.deps.config.commentRules.some(
        (rule) => rule.publicReplyMessage && rule.publicReplyMessage === text,
      )
    ) {
      logger.debug('COMMENT', 'Skipping comment matching our own reply text (loop protection)', {
        commentId,
      });
      return;
    }

    if (!(await this.deps.idempotency.markIfNew(`comment:${commentId}`))) {
      logger.debug('COMMENT', 'Duplicate comment event skipped', { commentId });
      this.deps.activity?.increment('duplicatesSkipped');
      return;
    }

    const applicableRules = this.deps.config.commentRules.filter(
      (rule) => !rule.mediaIds?.length || (value.media?.id && rule.mediaIds.includes(value.media.id)),
    );
    const rule = findMatchingRule(text, applicableRules);
    if (!rule) {
      logger.debug('COMMENT', 'No automation rule matched', { commentId });
      return;
    }
    logger.info('AUTOMATION', `Keyword matched: rule "${rule.id}"`, { commentId });
    this.deps.activity?.record('automation', `Comment matched rule "${rule.id}"`, {
      commentId,
      mediaId: value.media?.id,
      username: value.from?.username,
      textPreview: text.slice(0, 80),
    });

    const wantsDm = rule.action === 'private_reply' || rule.action === 'private_and_public_reply';
    const wantsPublicReply =
      rule.action === 'public_reply' || rule.action === 'private_and_public_reply';

    if (wantsDm && rule.dmMessage) {
      if (fromId && !this.deps.throttle.allow(fromId)) {
        logger.warn('AUTOMATION', 'Private reply throttled for user', { commentId });
      } else {
        try {
          await this.deps.instagram.sendPrivateReplyToComment(commentId, rule.dmMessage);
          logger.info('MESSAGE', 'Private reply (DM) sent for comment', { commentId });
          this.deps.activity?.increment('dmsSent');
          this.deps.activity?.record('message', 'Private reply sent for comment', { commentId });
        } catch (err) {
          this.logSendError('Failed to send private reply', err, commentId);
        }
      }
    }

    if (wantsPublicReply && rule.publicReplyMessage) {
      try {
        await this.deps.instagram.replyToComment(commentId, rule.publicReplyMessage);
        logger.info('COMMENT', 'Public reply sent', { commentId });
        this.deps.activity?.increment('publicRepliesSent');
        this.deps.activity?.record('comment', 'Public reply posted', { commentId });
      } catch (err) {
        this.logSendError('Failed to send public reply', err, commentId);
      }
    }
  }

  logSendError(context, err, commentId) {
    this.deps.activity?.increment('errors');
    if (err instanceof MetaApiError) {
      // Expected failures include: private reply already sent for this
      // comment, comment older than 7 days, or missing permissions.
      logger.error('AUTOMATION', `${context}: ${err.message}`, {
        commentId,
        status: err.status,
        code: err.graphError?.code,
        subcode: err.graphError?.error_subcode,
      });
      this.deps.activity?.record('error', context, { commentId, status: err.status });
    } else {
      logger.error('AUTOMATION', `${context}: ${err.message}`, { commentId });
      this.deps.activity?.record('error', context, { commentId });
    }
  }
}
