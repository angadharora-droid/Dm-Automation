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
const MAX_RULES = 50;
const MAX_KEYWORDS = 20;
const MAX_TEXT = 1000;

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

function cleanKeywords(keywords, label, errors) {
  if (!Array.isArray(keywords)) {
    errors.push(`${label}: keywords must be an array of strings`);
    return [];
  }
  const cleaned = keywords
    .filter((keyword) => typeof keyword === 'string')
    .map((keyword) => keyword.trim())
    .filter(Boolean);
  if (cleaned.length === 0) errors.push(`${label}: at least one keyword is required`);
  if (cleaned.length > MAX_KEYWORDS) errors.push(`${label}: at most ${MAX_KEYWORDS} keywords`);
  if (cleaned.some((keyword) => keyword.length > 100))
    errors.push(`${label}: keywords must be 100 characters or less`);
  return cleaned;
}

function cleanText(value, label, errors, { required = false } = {}) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (required && !text) errors.push(`${label} is required`);
  if (text.length > MAX_TEXT) errors.push(`${label} must be ${MAX_TEXT} characters or less`);
  return text || undefined;
}

/**
 * Validates and normalizes a full automation config (as submitted from the
 * dashboard rule editor). Returns { config, errors } — errors is empty when
 * the config is safe to save.
 */
export function validateAutomationConfig(input) {
  const errors = [];
  const source = input && typeof input === 'object' ? input : {};

  const commentRulesIn = Array.isArray(source.commentRules) ? source.commentRules : [];
  const dmRulesIn = Array.isArray(source.dmRules) ? source.dmRules : [];
  if (commentRulesIn.length > MAX_RULES) errors.push(`At most ${MAX_RULES} comment rules`);
  if (dmRulesIn.length > MAX_RULES) errors.push(`At most ${MAX_RULES} DM rules`);

  const commentRules = commentRulesIn.map((rule, index) => {
    const label = `Comment rule ${index + 1}`;
    const id = cleanText(rule?.id, `${label}: name`, errors, { required: true }) ?? `rule-${index + 1}`;
    const keywords = cleanKeywords(rule?.keywords, label, errors);
    const action = COMMENT_ACTIONS.includes(rule?.action) ? rule.action : null;
    if (!action) errors.push(`${label}: action must be one of ${COMMENT_ACTIONS.join(', ')}`);
    const dmMessage = cleanText(rule?.dmMessage, `${label}: DM message`, errors);
    const publicReplyMessage = cleanText(rule?.publicReplyMessage, `${label}: public reply`, errors);
    if ((action === 'private_reply' || action === 'private_and_public_reply') && !dmMessage)
      errors.push(`${label}: a DM message is required for action "${action}"`);
    if ((action === 'public_reply' || action === 'private_and_public_reply') && !publicReplyMessage)
      errors.push(`${label}: a public reply is required for action "${action}"`);
    const mediaIds = Array.isArray(rule?.mediaIds)
      ? rule.mediaIds.filter((id_) => typeof id_ === 'string').map((id_) => id_.trim()).filter(Boolean)
      : [];
    return { id, keywords, action: action ?? 'private_reply', dmMessage, publicReplyMessage, mediaIds };
  });

  const dmRules = dmRulesIn.map((rule, index) => {
    const label = `DM rule ${index + 1}`;
    const id = cleanText(rule?.id, `${label}: name`, errors, { required: true }) ?? `dm-rule-${index + 1}`;
    const keywords = cleanKeywords(rule?.keywords, label, errors);
    const reply = cleanText(rule?.reply, `${label}: reply`, errors, { required: true }) ?? '';
    return { id, keywords, reply };
  });

  const seen = new Set();
  for (const rule of [...commentRules, ...dmRules]) {
    if (seen.has(rule.id)) errors.push(`Duplicate rule name "${rule.id}" — names must be unique`);
    seen.add(rule.id);
  }

  const dmFallbackReply =
    typeof source.dmFallbackReply === 'string' && source.dmFallbackReply.trim()
      ? source.dmFallbackReply.trim().slice(0, MAX_TEXT)
      : null;

  return { config: { commentRules, dmRules, dmFallbackReply }, errors };
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
