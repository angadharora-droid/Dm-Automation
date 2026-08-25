import { logger } from '../../utils/logger.js';
import { findMatchingRule } from './keyword-matcher.js';

/**
 * Pluggable reply generation.
 *
 * The DM automation engine only depends on the ReplyGenerator contract:
 *
 *   generateReply({ channel, text, senderId }) -> Promise<string|null>
 *
 * (null = stay silent). An AI-backed implementation (e.g.
 * AnthropicReplyGenerator) can replace the rule-based one in app.js without
 * touching the Instagram/webhook integration.
 */

export class RuleBasedReplyGenerator {
  constructor(config) {
    this.config = config;
  }

  async generateReply(input) {
    const rule = findMatchingRule(input.text, this.config.dmRules);
    if (rule) {
      logger.info('AUTOMATION', `Keyword matched: rule "${rule.id}"`, { channel: input.channel });
      return rule.reply;
    }
    return this.config.dmFallbackReply;
  }
}
