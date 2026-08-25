/**
 * Reply-text personalization.
 *
 * Rule authors can use placeholders in any reply text:
 *   {username} — the commenter's / DM sender's Instagram username
 *               (write "Hey @{username}!" to render "Hey @somefan!")
 *   {name}     — the sender's display name (DMs only; falls back to username)
 *
 * When the value is unknown the placeholder degrades gracefully:
 * "@{username}" and "{username}" both become "there".
 */

export function renderTemplate(text, vars = {}) {
  let out = text;
  const username = typeof vars.username === 'string' ? vars.username.trim() : '';
  if (username) {
    out = out.replaceAll('{username}', username);
  } else {
    out = out.replaceAll('@{username}', 'there').replaceAll('{username}', 'there');
  }
  const name = (typeof vars.name === 'string' && vars.name.trim()) || username;
  if (name) {
    out = out.replaceAll('{name}', name);
  } else {
    out = out.replaceAll('{name}', 'there');
  }
  return out;
}

/** True when rendering this text would benefit from a profile lookup. */
export function templateNeedsProfile(text) {
  return typeof text === 'string' && (text.includes('{username}') || text.includes('{name}'));
}
