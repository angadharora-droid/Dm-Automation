import { MongoClient } from 'mongodb';
import { logger } from '../../utils/logger.js';

/**
 * MongoDB connection bootstrap.
 *
 * Returns { client, db } when MONGODB_URI is configured and reachable,
 * otherwise null — the app then falls back to the in-memory stores so local
 * development works without a database. The URI is a secret (it usually
 * embeds credentials) and is never logged; the logger also redacts it.
 */
export async function connectMongo(config) {
  if (!config.mongodbUri) {
    logger.warn(
      'DB',
      'MONGODB_URI is not set — using in-memory stores (events/counters reset on every restart)',
    );
    return null;
  }
  const client = new MongoClient(config.mongodbUri, {
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS: 5_000,
  });
  try {
    await client.connect();
    const db = client.db(config.mongodbDbName);
    await db.command({ ping: 1 });
    logger.info('DB', `Connected to MongoDB (database "${config.mongodbDbName}")`);
    return { client, db };
  } catch (err) {
    logger.error(
      'DB',
      `Failed to connect to MongoDB: ${err.message}. Falling back to in-memory stores.`,
    );
    await client.close().catch(() => {});
    return null;
  }
}
