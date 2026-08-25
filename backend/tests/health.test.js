import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTestServices, setBaseTestEnv } from './helpers.js';

describe('GET /health', () => {
  beforeEach(() => setBaseTestEnv());

  it('returns 200 with status ok and no secrets', async () => {
    const app = createApp(createTestServices().services);
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(JSON.stringify(res.body)).not.toContain('test-access-token');
  });

  it('returns 404 JSON for unknown routes', async () => {
    const app = createApp(createTestServices().services);
    const res = await request(app).get('/nope').expect(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
