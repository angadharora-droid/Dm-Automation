import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { MetaApiError } from '../src/services/meta/meta-api.service.js';
import { createTestServices, setBaseTestEnv } from './helpers.js';

const ADMIN = { 'x-admin-key': 'pa-admin-key' };

describe('GET /api/dashboard/posts', () => {
  beforeEach(() => {
    setBaseTestEnv();
    process.env.ADMIN_API_KEY = 'pa-admin-key';
  });

  it('requires admin auth', async () => {
    const app = createApp(createTestServices().services);
    await request(app).get('/api/dashboard/posts').expect(401);
  });

  it('returns normalized posts with their IDs', async () => {
    const { services, instagram } = createTestServices();
    const app = createApp(services);
    const res = await request(app).get('/api/dashboard/posts').set(ADMIN).expect(200);
    expect(res.body.posts).toHaveLength(1);
    expect(res.body.posts[0]).toMatchObject({
      id: '17900000000000001',
      mediaType: 'IMAGE',
      likeCount: 42,
      commentsCount: 7,
    });
    expect(instagram.getRecentMedia).toHaveBeenCalledTimes(1);
  });

  it('caches posts for repeated requests', async () => {
    const { services, instagram } = createTestServices();
    const app = createApp(services);
    await request(app).get('/api/dashboard/posts').set(ADMIN).expect(200);
    const second = await request(app).get('/api/dashboard/posts').set(ADMIN).expect(200);
    expect(second.body.cached).toBe(true);
    expect(instagram.getRecentMedia).toHaveBeenCalledTimes(1);
  });

  it('returns 502 without internals when the Meta API fails', async () => {
    const { services, instagram } = createTestServices();
    instagram.getRecentMedia.mockRejectedValueOnce(new MetaApiError('token expired', 401));
    const app = createApp(services);
    const res = await request(app).get('/api/dashboard/posts').set(ADMIN).expect(502);
    expect(res.body).toEqual({ error: 'Failed to load posts from the Meta API' });
  });
});

describe('GET /api/dashboard/analytics', () => {
  beforeEach(() => {
    setBaseTestEnv();
    process.env.ADMIN_API_KEY = 'pa-admin-key';
  });

  it('requires admin auth', async () => {
    const app = createApp(createTestServices().services);
    await request(app).get('/api/dashboard/analytics').expect(401);
  });

  it('returns zero-filled per-day buckets including today’s increments', async () => {
    const { services, activity } = createTestServices();
    activity.increment('commentsReceived');
    activity.increment('commentsReceived');
    activity.increment('dmsSent');
    const app = createApp(services);

    const res = await request(app)
      .get('/api/dashboard/analytics')
      .query({ days: 7 })
      .set(ADMIN)
      .expect(200);

    expect(res.body.days).toHaveLength(7);
    const today = res.body.days[6];
    expect(today.date).toBe(new Date().toISOString().slice(0, 10));
    expect(today.commentsReceived).toBe(2);
    expect(today.dmsSent).toBe(1);
    expect(res.body.days[0].commentsReceived).toBe(0);
    expect(res.body.totals.commentsReceived).toBe(2);
  });

  it('clamps the days parameter', async () => {
    const app = createApp(createTestServices().services);
    const res = await request(app)
      .get('/api/dashboard/analytics')
      .query({ days: 9999 })
      .set(ADMIN)
      .expect(200);
    expect(res.body.days).toHaveLength(30);
  });
});
