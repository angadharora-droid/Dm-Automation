/**
 * In-memory activity feed + counters backing the admin dashboard.
 *
 * Contract shared with MongoActivityLog (services/db/):
 *   record(type, message, meta)  -> void (fire-and-forget)
 *   increment(counterName)       -> void (fire-and-forget)
 *   getEntries(limit)            -> entries | Promise<entries> (newest first)
 *   getCounters()                -> counters | Promise<counters>
 *   startedAt                    -> ISO string
 *
 * Ring buffer semantics: keeps the most recent `maxEntries` entries only, and
 * everything is cleared on restart. Used when MONGODB_URI is not configured.
 *
 * Never store secrets or full DM text here: entries are served to the
 * dashboard API.
 */

export const EMPTY_COUNTERS = Object.freeze({
  webhooksReceived: 0,
  commentsReceived: 0,
  messagesReceived: 0,
  publicRepliesSent: 0,
  dmsSent: 0,
  duplicatesSkipped: 0,
  errors: 0,
});

/** UTC day key, e.g. "2026-08-25". */
export function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** Last `days` UTC day keys, oldest first, ending today. */
export function lastDayKeys(days, now = new Date()) {
  const keys = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    keys.push(dayKey(new Date(now.getTime() - i * 24 * 60 * 60 * 1000)));
  }
  return keys;
}

export class ActivityLog {
  constructor(maxEntries = 200) {
    this.startedAt = new Date().toISOString();
    this.maxEntries = maxEntries;
    this.nextId = 1;
    this.entries = [];
    this.counters = { ...EMPTY_COUNTERS };
    /** date key -> partial counters (kept ~30 days). */
    this.daily = new Map();
  }

  record(type, message, meta) {
    this.entries.push({
      id: this.nextId++,
      timestamp: new Date().toISOString(),
      type,
      message,
      meta,
    });
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  increment(counter) {
    if (!(counter in this.counters)) return;
    this.counters[counter] += 1;
    const key = dayKey();
    const bucket = this.daily.get(key) ?? {};
    bucket[counter] = (bucket[counter] ?? 0) + 1;
    this.daily.set(key, bucket);
    while (this.daily.size > 31) {
      const oldest = this.daily.keys().next().value;
      if (oldest === undefined) break;
      this.daily.delete(oldest);
    }
  }

  /** Per-day counters for the last `days` days (zero-filled), oldest first. */
  getDailyStats(days = 14) {
    return lastDayKeys(days).map((date) => ({
      date,
      ...EMPTY_COUNTERS,
      ...(this.daily.get(date) ?? {}),
    }));
  }

  /** Newest first. */
  getEntries(limit = 50) {
    return this.entries.slice(-limit).reverse();
  }

  getCounters() {
    return { ...this.counters };
  }
}
