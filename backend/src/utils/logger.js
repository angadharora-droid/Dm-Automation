const LEVEL_ORDER = { debug: 10, info: 20, warn: 30, error: 40 };

function activeLevel() {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  return raw in LEVEL_ORDER ? raw : 'info';
}

/**
 * Values that must never appear in log output. Evaluated on every call so the
 * list stays correct even if the environment changes after startup.
 */
function secretValues() {
  return [
    process.env.META_APP_SECRET,
    process.env.INSTAGRAM_ACCESS_TOKEN,
    process.env.META_VERIFY_TOKEN,
    process.env.ADMIN_API_KEY,
    process.env.MONGODB_URI,
  ].filter((value) => Boolean(value && value.length >= 4));
}

export function redactSecrets(text) {
  let out = text;
  for (const secret of secretValues()) {
    out = out.split(secret).join('[REDACTED]');
  }
  return out;
}

function serializeMeta(meta) {
  if (meta === undefined) return '';
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return ' [unserializable meta]';
  }
}

function write(level, tag, message, meta) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[activeLevel()]) return;
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] [${tag}] ${message}${serializeMeta(meta)}`;
  const safeLine = redactSecrets(line);
  if (level === 'error') console.error(safeLine);
  else if (level === 'warn') console.warn(safeLine);
  else console.log(safeLine);
}

export const logger = {
  debug: (tag, message, meta) => write('debug', tag, message, meta),
  info: (tag, message, meta) => write('info', tag, message, meta),
  warn: (tag, message, meta) => write('warn', tag, message, meta),
  error: (tag, message, meta) => write('error', tag, message, meta),
};
