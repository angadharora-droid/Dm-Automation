import { Buffer } from 'node:buffer';

/**
 * High-level Instagram operations for the Instagram API with Instagram Login.
 *
 * Endpoints verified against the official Meta documentation (Aug 2026):
 * - Send DM:            POST /<IG_ID>/messages  { recipient: { id }, message: { text } }
 *   https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api
 * - Private reply:      POST /<IG_ID>/messages  { recipient: { comment_id }, message: { text } }
 *   https://developers.facebook.com/docs/instagram-platform/private-replies
 * - Reply to comment:   POST /<IG_COMMENT_ID>/replies  { message }
 *   https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/comment-moderation
 * - Enable webhooks:    POST /<IG_ID>/subscribed_apps?subscribed_fields=comments,messages
 *   https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/webhooks
 */

/** Message text must be UTF-8 and 1000 bytes or less (per Meta messaging docs). */
const MAX_MESSAGE_BYTES = 1000;

export function truncateUtf8Bytes(text, maxBytes = MAX_MESSAGE_BYTES) {
  const buf = Buffer.from(text, 'utf8');
  if (buf.length <= maxBytes) return text;
  // Slicing can cut a multi-byte character in half; decoding turns the partial
  // character into U+FFFD, which we strip.
  return buf.subarray(0, maxBytes).toString('utf8').replace(/�+$/u, '');
}

export class InstagramService {
  /**
   * @param {import('./meta-api.service.js').MetaApiClient} api
   * @param {string} [accountId] Instagram professional account ID; falls back to /me when unset.
   */
  constructor(api, accountId) {
    this.api = api;
    this.accountId = accountId;
  }

  get accountPath() {
    return `/${this.accountId ?? 'me'}`;
  }

  /** Requires instagram_business_basic. */
  getAccountInfo() {
    return this.api.get('/me', {
      fields: 'user_id,username,account_type,name',
    });
  }

  /**
   * Profile of a message sender by Instagram-scoped ID (IGSID).
   * Requires instagram_business_basic + instagram_business_manage_messages,
   * and only works for users who have messaged the account (Meta's consent
   * rule) — which is exactly the DM-reply case.
   */
  getUserProfile(igsid) {
    return this.api.get(`/${igsid}`, { fields: 'name,username' });
  }

  /**
   * Recent posts (GET /<IG_ID>/media). All fields available with
   * instagram_business_basic; thumbnail_url is only present on VIDEO media.
   */
  getRecentMedia(limit = 24) {
    return this.api.get(`${this.accountPath}/media`, {
      fields:
        'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
      limit,
    });
  }

  /** Public reply to a comment. Requires instagram_business_manage_comments. */
  replyToComment(commentId, message) {
    return this.api.post(`/${commentId}/replies`, {
      message: truncateUtf8Bytes(message),
    });
  }

  /**
   * Private reply (DM) to a commenter. Meta allows exactly one private reply
   * per comment, within 7 days of the comment.
   * Requires instagram_business_manage_comments.
   */
  sendPrivateReplyToComment(commentId, text) {
    return this.api.post(`${this.accountPath}/messages`, {
      recipient: { comment_id: commentId },
      message: { text: truncateUtf8Bytes(text) },
    });
  }

  /**
   * Send a text DM to an Instagram-scoped user ID (IGSID). Only allowed within
   * 24 hours of the user's last message to the account.
   * Requires instagram_business_manage_messages.
   */
  sendTextMessage(recipientIgsid, text) {
    return this.api.post(`${this.accountPath}/messages`, {
      recipient: { id: recipientIgsid },
      message: { text: truncateUtf8Bytes(text) },
    });
  }

  /**
   * Enable webhook delivery for this account. Meta requires this in addition
   * to the App Dashboard webhook configuration.
   */
  subscribeToWebhookFields(fields = ['comments', 'messages']) {
    return this.api.post(`${this.accountPath}/subscribed_apps`, undefined, {
      subscribed_fields: fields.join(','),
    });
  }
}
