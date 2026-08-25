import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTestServices, setBaseTestEnv, TEST_VERIFY_TOKEN } from './helpers.js';

describe('GET /webhooks/instagram (Meta verification handshake)', () => {
  beforeEach(() => setBaseTestEnv());

  it('echoes hub.challenge when the verify token matches', async () => {
    const app = createApp(createTestServices().services);
    const res = await request(app)
      .get('/webhooks/instagram')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': TEST_VERIFY_TOKEN,
        'hub.challenge': '1158201444',
      })
      .expect(200);
    expect(res.text).toBe('1158201444');
  });

  it('rejects an invalid verify token with 403', async () => {
    const app = createApp(createTestServices().services);
    await request(app)
      .get('/webhooks/instagram')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong-token',
        'hub.challenge': '123',
      })
      .expect(403);
  });

  it('rejects a wrong hub.mode with 403', async () => {
    const app = createApp(createTestServices().services);
    await request(app)
      .get('/webhooks/instagram')
      .query({
        'hub.mode': 'unsubscribe',
        'hub.verify_token': TEST_VERIFY_TOKEN,
        'hub.challenge': '123',
      })
      .expect(403);
  });

  it('rejects when META_VERIFY_TOKEN is not configured', async () => {
    delete process.env.META_VERIFY_TOKEN;
    const app = createApp(createTestServices().services);
    await request(app)
      .get('/webhooks/instagram')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': '', 'hub.challenge': '123' })
      .expect(403);
  });
});
