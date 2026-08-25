import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTestServices, setBaseTestEnv } from './helpers.js';

describe('admin dashboard API', () => {
  beforeEach(() => setBaseTestEnv());

  it('returns 503 when ADMIN_API_KEY is not configured', async () => {
    const app = createApp(createTestServices().services);
    await request(app).get('/api/dashboard/overview').expect(503);
    await request(app).get('/api/instagram/account').expect(503);
  });

  it('returns 401 for a wrong admin key', async () => {
    process.env.ADMIN_API_KEY = 'super-secret-admin-key';
    const app = createApp(createTestServices().services);
    await request(app).get('/api/dashboard/overview').set('x-admin-key', 'wrong').expect(401);
  });

  it('returns overview data without leaking secret values', async () => {
    process.env.ADMIN_API_KEY = 'super-secret-admin-key';
    const app = createApp(createTestServices().services);
    const res = await request(app)
      .get('/api/dashboard/overview')
      .set('x-admin-key', 'super-secret-admin-key')
      .expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('in-memory');
    expect(res.body.configured).toEqual({
      metaAppSecret: true,
      metaVerifyToken: true,
      instagramAccessToken: true,
      instagramAccountId: true,
      mongodb: false,
    });
    expect(res.body.counters).toBeDefined();

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('test-access-token');
    expect(serialized).not.toContain('test-app-secret');
    expect(serialized).not.toContain('test-verify-token');
  });

  it('serves activity entries and rules with a valid key', async () => {
    process.env.ADMIN_API_KEY = 'super-secret-admin-key';
    const { services, activity } = createTestServices();
    activity.record('webhook', 'Instagram webhook received', { entries: 1 });
    const app = createApp(services);

    const activityRes = await request(app)
      .get('/api/dashboard/activity')
      .set('x-admin-key', 'super-secret-admin-key')
      .expect(200);
    expect(activityRes.body.entries).toHaveLength(1);
    expect(activityRes.body.entries[0].message).toBe('Instagram webhook received');

    const rulesRes = await request(app)
      .get('/api/dashboard/rules')
      .set('x-admin-key', 'super-secret-admin-key')
      .expect(200);
    expect(rulesRes.body.commentRules).toHaveLength(1);
    expect(rulesRes.body.dmRules).toHaveLength(1);
  });

  it('serves account info through the admin instagram endpoint', async () => {
    process.env.ADMIN_API_KEY = 'super-secret-admin-key';
    const { services, instagram } = createTestServices();
    const app = createApp(services);
    const res = await request(app)
      .get('/api/instagram/account')
      .set('x-admin-key', 'super-secret-admin-key')
      .expect(200);
    expect(res.body.username).toBe('testaccount');
    expect(instagram.getAccountInfo).toHaveBeenCalledTimes(1);
  });
});
