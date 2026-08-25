/**
 * Duplicate-event protection.
 *
 * Meta redelivers webhook events (retries on slow/failed responses, occasional
 * duplicates), so every event is checked against a store before automation
 * runs. The store contract is:
 *
 *   markIfNew(key) -> Promise<boolean>   // true = first time, process it
 *                                        // false = duplicate, skip it
 *
 * Production uses MongoIdempotencyStore (services/db/); this in-memory
 * implementation is the fallback for local development and tests — it is
 * emptied on every restart and not shared between instances.
 */

export class InMemoryIdempotencyStore {
  /**
   * @param {number} [ttlMs]
   * @param {number} [maxEntries]
   * @param {() => number} [now] injectable clock for tests
   */
  constructor(ttlMs = 24 * 60 * 60 * 1000, maxEntries = 10_000, now = Date.now) {
    /** key -> expiry timestamp (ms). Map preserves insertion order for eviction. */
    this.entries = new Map();
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.now = now;
  }

  async markIfNew(key) {
    const nowMs = this.now();
    const expiresAt = this.entries.get(key);
    if (expiresAt !== undefined && expiresAt > nowMs) {
      return false;
    }
    if (expiresAt !== undefined) {
      this.entries.delete(key);
    }
    this.evictIfNeeded(nowMs);
    this.entries.set(key, nowMs + this.ttlMs);
    return true;
  }

  evictIfNeeded(nowMs) {
    if (this.entries.size < this.maxEntries) return;
    for (const [key, expiresAt] of this.entries) {
      if (expiresAt <= nowMs) this.entries.delete(key);
    }
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}
