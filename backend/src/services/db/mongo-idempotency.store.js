import { logger } from '../../utils/logger.js';

/**
 * MongoDB-backed duplicate-event protection.
 *
 * Uses the `processed_events` collection with the event key as _id, so
 * `insertOne` is an atomic "insert if new" — a duplicate key error (11000)
 * means the event was already processed, even across multiple instances.
 * A TTL index on `createdAt` expires entries automatically.
 *
 * Fail-open on database errors: if Mongo is briefly unreachable it is better
 * to risk one duplicate reply than to drop a customer's message entirely.
 */
export class MongoIdempotencyStore {
  /**
   * @param {import('mongodb').Db} db
   * @param {number} [ttlSeconds]
   */
  constructor(db, ttlSeconds = 24 * 60 * 60) {
    this.collection = db.collection('processed_events');
    this.ttlSeconds = ttlSeconds;
  }

  async init() {
    await this.collection.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: this.ttlSeconds, name: 'ttl_createdAt' },
    );
    return this;
  }

  async markIfNew(key) {
    try {
      await this.collection.insertOne({ _id: key, createdAt: new Date() });
      return true;
    } catch (err) {
      if (err?.code === 11000) return false; // duplicate key = already processed
      logger.error('DB', `Idempotency check failed: ${err.message}; processing event anyway`);
      return true;
    }
  }
}
