import { logger } from '../../utils/logger.js';

/**
 * Live automation-rule storage, editable from the dashboard.
 *
 * Contract: getConfig() -> Promise<AutomationConfig>, setConfig(config) ->
 * Promise<AutomationConfig>. The automation services read the config per
 * event, so edits take effect immediately without a restart.
 *
 * MongoRuleStore keeps one document in `automation_config`; the config passed
 * as `fallback` (from the AUTOMATION_RULES env var, or empty) is used until
 * the first save. InMemoryRuleStore is the no-database fallback — edits work
 * but reset on restart.
 */

export class InMemoryRuleStore {
  constructor(initialConfig) {
    this.config = initialConfig;
  }

  async getConfig() {
    return this.config;
  }

  async setConfig(config) {
    this.config = config;
    return config;
  }
}

const CONFIG_ID = 'config';
const CACHE_TTL_MS = 10_000;

export class MongoRuleStore {
  /**
   * @param {import('mongodb').Db} db
   * @param {object} fallback config used until the first dashboard save
   */
  constructor(db, fallback) {
    this.collection = db.collection('automation_config');
    this.fallback = fallback;
    this.cached = null;
    this.cachedAt = 0;
  }

  async getConfig() {
    const now = Date.now();
    if (this.cached && now - this.cachedAt < CACHE_TTL_MS) return this.cached;
    try {
      const doc = await this.collection.findOne({ _id: CONFIG_ID });
      this.cached = doc?.config ?? this.fallback;
      this.cachedAt = now;
      return this.cached;
    } catch (err) {
      logger.error('DB', `Failed to load automation rules: ${err.message}; using last known config`);
      return this.cached ?? this.fallback;
    }
  }

  async setConfig(config) {
    await this.collection.updateOne(
      { _id: CONFIG_ID },
      { $set: { config, updatedAt: new Date() } },
      { upsert: true },
    );
    this.cached = config;
    this.cachedAt = Date.now();
    return config;
  }
}
