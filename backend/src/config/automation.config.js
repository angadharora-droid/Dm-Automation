import { logger } from '../utils/logger.js';

/**
 * Automation rule configuration.
 *
 * Rules live here (with an env-var override) instead of being scattered
 * through the code, so campaigns can be changed without touching the
 * automation engine. Later this can move to MongoDB per-post/per-campaign.
 *
 * Rule shapes:
 * - comment rule: { id, keywords[], action, dmMessage?, publicReplyMessage?, mediaIds? }
 *   where action is 'private_reply' | 'public_reply' | 'private_and_public_reply'
 * - dm rule: { id, keywords[], reply }
 *
 * NOTE: keep automated reply texts free of the trigger keywords themselves.
 * The webhook also delivers comments/messages our own account creates, and
 * keyword-free replies are one of the layers preventing self-reply loops.
 */
export const defaultAutomationConfig = {
  commentRules: [
    {
      id: 'comment-interest-keywords',
      keywords: ['price', 'info', 'details', 'buy', 'link'],
      action: 'private_and_public_reply',
      dmMessage:
        "Hi! Thanks for your interest. I'll send you everything you need to know — reply here if you have any questions!",
      publicReplyMessage: 'Thanks for reaching out — just sent you a DM! 📩',
    },
  ],
  dmRules: [
    {
      id: 'dm-price',
      keywords: ['price', 'cost', 'how much'],
      reply: "Hi! I'd be happy to help. I'll share the pricing with you right away — one moment!",
    },
    {
      id: 'dm-interest-keywords',
      keywords: ['info', 'details', 'buy', 'link'],
      reply: 'Hi! Thanks for your message — here is what you asked for. Let me know if I can help with anything else!',
    },
  ],
  dmFallbackReply: null,
};

const COMMENT_ACTIONS = ['private_reply', 'public_reply', 'private_and_public_reply'];

function isValidCommentRule(rule) {
  return (
    typeof rule?.id === 'string' &&
    Array.isArray(rule.keywords) &&
    rule.keywords.every((keyword) => typeof keyword === 'string') &&
    COMMENT_ACTIONS.includes(rule.action)
  );
}

function isValidDmRule(rule) {
  return (
    typeof rule?.id === 'string' &&
    Array.isArray(rule.keywords) &&
    rule.keywords.every((keyword) => typeof keyword === 'string') &&
    typeof rule.reply === 'string'
  );
}

/**
 * Loads rules from the AUTOMATION_RULES env var (JSON matching the shape
 * above) or falls back to the defaults.
 */
export function loadAutomationConfig() {
  const raw = process.env.AUTOMATION_RULES;
  if (!raw) return defaultAutomationConfig;
  try {
    const parsed = JSON.parse(raw);
    const commentRules = Array.isArray(parsed.commentRules)
      ? parsed.commentRules.filter(isValidCommentRule)
      : defaultAutomationConfig.commentRules;
    const dmRules = Array.isArray(parsed.dmRules)
      ? parsed.dmRules.filter(isValidDmRule)
      : defaultAutomationConfig.dmRules;
    const dmFallbackReply =
      typeof parsed.dmFallbackReply === 'string' ? parsed.dmFallbackReply : null;
    logger.info('AUTOMATION', 'Loaded automation rules from AUTOMATION_RULES env var', {
      commentRules: commentRules.length,
      dmRules: dmRules.length,
    });
    return { commentRules, dmRules, dmFallbackReply };
  } catch {
    logger.warn('AUTOMATION', 'Failed to parse AUTOMATION_RULES env var; using default rules');
    return defaultAutomationConfig;
  }
}
