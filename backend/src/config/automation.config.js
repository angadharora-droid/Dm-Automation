import { logger } from '../utils/logger.js';

/**
 * Automation rule configuration.
 *
 * No rules ship by default — the owner defines their own via the
 * AUTOMATION_RULES environment variable (JSON matching the shapes below).
 * With no rules configured the bot receives events but never replies.
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
  commentRules: [],
  dmRules: [],
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
