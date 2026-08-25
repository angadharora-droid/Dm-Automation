/**
 * Per-recipient send throttle.
 *
 * A safety net against reply storms and loops: even if every other guard
 * fails, the backend will never send more than `maxPerWindow` automated
 * replies to the same user within `windowMs`.
 *
 * In-memory (single instance). For multi-instance production, back this with
 * MongoDB/Redis the same way as the idempotency store.
 */
export class ReplyThrottle {
  /**
   * @param {number} [maxPerWindow]
   * @param {number} [windowMs]
   * @param {() => number} [now] injectable clock for tests
   */
  constructor(maxPerWindow = 3, windowMs = 60_000, now = Date.now) {
    this.sentTimestamps = new Map();
    this.maxPerWindow = maxPerWindow;
    this.windowMs = windowMs;
    this.now = now;
  }

  /** Returns true when a send to this recipient is allowed right now. */
  allow(recipientId) {
    const nowMs = this.now();
    const recent = (this.sentTimestamps.get(recipientId) ?? []).filter(
      (timestamp) => nowMs - timestamp < this.windowMs,
    );
    if (recent.length >= this.maxPerWindow) {
      this.sentTimestamps.set(recipientId, recent);
      return false;
    }
    recent.push(nowMs);
    this.sentTimestamps.set(recipientId, recent);
    if (this.sentTimestamps.size > 10_000) {
      const oldest = this.sentTimestamps.keys().next().value;
      if (oldest !== undefined) this.sentTimestamps.delete(oldest);
    }
    return true;
  }
}
