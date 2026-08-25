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

export class ActivityLog {
  constructor(maxEntries = 200) {
    this.startedAt = new Date().toISOString();
    this.maxEntries = maxEntries;
    this.nextId = 1;
    this.entries = [];
    this.counters = { ...EMPTY_COUNTERS };
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
    if (counter in this.counters) this.counters[counter] += 1;
  }

  /** Newest first. */
  getEntries(limit = 50) {
    return this.entries.slice(-limit).reverse();
  }

  getCounters() {
    return { ...this.counters };
  }
}
