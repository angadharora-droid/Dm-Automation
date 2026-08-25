import { EMPTY_COUNTERS } from '../events/activity-log.js';
import { logger } from '../../utils/logger.js';

const COUNTERS_ID = 'counters';

/**
 * MongoDB-backed activity feed + counters for the admin dashboard.
 * Same contract as the in-memory ActivityLog (see services/events/activity-log.js).
 *
 * - `activity_log` collection: one document per event, TTL-expired after
 *   `entryTtlSeconds` (default 7 days).
 * - `dashboard_counters` collection: a single document incremented with $inc,
 *   so counts survive restarts and are correct across multiple instances.
 *
 * record()/increment() are fire-and-forget so a slow database never blocks
 * webhook processing.
 */
export class MongoActivityLog {
  /**
   * @param {import('mongodb').Db} db
   * @param {number} [entryTtlSeconds]
   */
  constructor(db, entryTtlSeconds = 7 * 24 * 60 * 60) {
    this.startedAt = new Date().toISOString();
    this.entriesCollection = db.collection('activity_log');
    this.countersCollection = db.collection('dashboard_counters');
    this.entryTtlSeconds = entryTtlSeconds;
  }

  async init() {
    await this.entriesCollection.createIndex(
      { timestamp: 1 },
      { expireAfterSeconds: this.entryTtlSeconds, name: 'ttl_timestamp' },
    );
    return this;
  }

  record(type, message, meta) {
    this.entriesCollection
      .insertOne({ timestamp: new Date(), type, message, meta })
      .catch((err) => logger.error('DB', `Failed to record activity entry: ${err.message}`));
  }

  increment(counter) {
    if (!(counter in EMPTY_COUNTERS)) return;
    this.countersCollection
      .updateOne({ _id: COUNTERS_ID }, { $inc: { [counter]: 1 } }, { upsert: true })
      .catch((err) => logger.error('DB', `Failed to increment counter: ${err.message}`));
  }

  /** Newest first. */
  async getEntries(limit = 50) {
    const docs = await this.entriesCollection
      .find({}, { projection: { _id: 1, timestamp: 1, type: 1, message: 1, meta: 1 } })
      .sort({ timestamp: -1, _id: -1 })
      .limit(limit)
      .toArray();
    return docs.map((doc) => ({
      id: String(doc._id),
      timestamp: doc.timestamp instanceof Date ? doc.timestamp.toISOString() : doc.timestamp,
      type: doc.type,
      message: doc.message,
      meta: doc.meta,
    }));
  }

  async getCounters() {
    const doc = await this.countersCollection.findOne({ _id: COUNTERS_ID });
    const counters = { ...EMPTY_COUNTERS };
    for (const key of Object.keys(counters)) {
      if (typeof doc?.[key] === 'number') counters[key] = doc[key];
    }
    return counters;
  }
}
