/**
 * Keyword matching — mirrors the backend's
 * backend/src/services/automation/keyword-matcher.js so the dashboard's
 * "test a message" simulator predicts exactly what the automation will do.
 */

function normalize(text) {
  return text.toLowerCase().normalize('NFKC');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function textMatchesKeyword(text, keyword) {
  const normalizedText = normalize(text);
  const normalizedKeyword = normalize(keyword.trim());
  if (!normalizedKeyword) return false;
  if (normalizedKeyword.includes(' ')) {
    return normalizedText.includes(normalizedKeyword);
  }
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}_])${escapeRegExp(normalizedKeyword)}($|[^\\p{L}\\p{N}_])`,
    'u',
  );
  return pattern.test(normalizedText);
}

export function findMatchingRule(text, rules) {
  return rules.find((rule) => rule.keywords.some((keyword) => textMatchesKeyword(text, keyword)));
}
