import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import {
  createSessionToken,
  getSessionSecret,
  verifySessionToken,
} from '../src/services/auth/session.js';
import { getConfig } from '../src/config/env.js';
import { createTestServices, setBaseTestEnv } from './helpers.js';

let ipCounter = 0;
/** Unique client IP per test so the per-IP login throttle never bleeds across tests. */
function uniqueIp() {
  ipCounter += 1;
  return `10.1.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    setBaseTestEnv();
    process.env.ADMIN_USERNAME = 'micky';
    process.env.ADMIN_PASSWORD = 'correct-horse-battery';
  });

  it('returns 503 when password login is not configured', async () => {
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
    const app = createApp(createTestServices().services);
    await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ username: 'micky', password: 'x' })
      .expect(503);
  });

  it('rejects wrong credentials with 401 and a generic message', async () => {
    const app = createApp(createTestServices().services);
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ username: 'micky', password: 'wrong' })
      .expect(401);
    expect(res.body.error).toBe('Invalid login ID or password.');

    await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ username: 'someone-else', password: 'correct-horse-battery' })
      .expect(401);
  });

  it('issues a token that grants access to admin endpoints', async () => {
    const app = createApp(createTestServices().services);
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ username: 'micky', password: 'correct-horse-battery' })
      .expect(200);

    expect(res.body.token).toBeTruthy();
    expect(res.body.expiresAt).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toContain('correct-horse-battery');

    const overview = await request(app)
      .get('/api/dashboard/overview')
      .set('authorization', `Bearer ${res.body.token}`)
      .expect(200);
    expect(overview.body.status).toBe('ok');
  });

  it('rejects invalid and expired session tokens', async () => {
    const app = createApp(createTestServices().services);
    await request(app)
      .get('/api/dashboard/overview')
      .set('authorization', 'Bearer not-a-real-token')
      .expect(401);

    const secret = getSessionSecret(getConfig());
    const expired = createSessionToken('micky', secret, -1000);
    await request(app)
      .get('/api/dashboard/overview')
      .set('authorization', `Bearer ${expired}`)
      .expect(401);
  });

  it('throttles repeated login attempts from one IP', async () => {
    const app = createApp(createTestServices().services);
    const ip = uniqueIp();
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ username: 'micky', password: 'wrong' })
        .expect(401);
    }
    await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ username: 'micky', password: 'correct-horse-battery' })
      .expect(429);
  });

  it('keeps the x-admin-key method working alongside password login', async () => {
    process.env.ADMIN_API_KEY = 'legacy-admin-key';
    const app = createApp(createTestServices().services);
    await request(app)
      .get('/api/dashboard/overview')
      .set('x-admin-key', 'legacy-admin-key')
      .expect(200);
  });
});

describe('session token primitives', () => {
  it('round-trips a valid token and rejects tampering', () => {
    const token = createSessionToken('micky', 'secret-a');
    expect(verifySessionToken(token, 'secret-a')?.username).toBe('micky');
    expect(verifySessionToken(token, 'secret-b')).toBeNull();
    expect(verifySessionToken(`${token}x`, 'secret-a')).toBeNull();
    expect(verifySessionToken('garbage', 'secret-a')).toBeNull();
  });
});
