import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createTestServices, setBaseTestEnv, SELF_ACCOUNT_ID, signBody } from './helpers.js';

function commentEventBody(text, commentId = 'comment-1', fromId = 'user-1') {
  return JSON.stringify({
    object: 'instagram',
    entry: [
      {
        id: SELF_ACCOUNT_ID,
        time: 1755000000,
        changes: [
          {
            field: 'comments',
            value: {
              id: commentId,
              from: { id: fromId, username: 'somefan' },
              media: { id: 'media-1', media_product_type: 'FEED' },
              text,
            },
          },
        ],
      },
    ],
  });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('POST /webhooks/instagram', () => {
  beforeEach(() => setBaseTestEnv());

  it('accepts a signed comment event and runs comment automation', async () => {
    const { services, instagram } = createTestServices();
    const app = createApp(services);
    const body = commentEventBody('What is the PRICE?');

    await request(app)
      .post('/webhooks/instagram')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', signBody(body))
      .send(body)
      .expect(200);

    await vi.waitFor(() => {
      expect(instagram.sendPrivateReplyToComment).toHaveBeenCalledWith(
        'comment-1',
        'Test DM message',
      );
      expect(instagram.replyToComment).toHaveBeenCalledWith('comment-1', 'Test public reply');
    });
  });

  it('accepts a signed message event and runs DM automation', async () => {
    const { services, instagram } = createTestServices();
    const app = createApp(services);
    const body = JSON.stringify({
      object: 'instagram',
      entry: [
        {
          id: SELF_ACCOUNT_ID,
          time: 1755000000,
          messaging: [
            {
              sender: { id: 'igsid-42' },
              recipient: { id: SELF_ACCOUNT_ID },
              timestamp: 1755000000000,
              message: { mid: 'mid-1', text: 'hi, what is the price?' },
            },
          ],
        },
      ],
    });

    await request(app)
      .post('/webhooks/instagram')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', signBody(body))
      .send(body)
      .expect(200);

    await vi.waitFor(() => {
      expect(instagram.sendTextMessage).toHaveBeenCalledWith('igsid-42', 'Test DM rule reply');
    });
  });

  it('rejects an invalid signature with 401 and does not process the event', async () => {
    const { services, instagram } = createTestServices();
    const app = createApp(services);
    const body = commentEventBody('PRICE');

    await request(app)
      .post('/webhooks/instagram')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', 'sha256=deadbeef')
      .send(body)
      .expect(401);

    await settle();
    expect(instagram.sendPrivateReplyToComment).not.toHaveBeenCalled();
  });

  it('rejects a missing signature header with 401', async () => {
    const { services } = createTestServices();
    const app = createApp(services);
    const body = commentEventBody('PRICE');

    await request(app)
      .post('/webhooks/instagram')
      .set('content-type', 'application/json')
      .send(body)
      .expect(401);
  });

  it('rejects webhooks when META_APP_SECRET is not configured', async () => {
    delete process.env.META_APP_SECRET;
    const { services } = createTestServices();
    const app = createApp(services);
    const body = commentEventBody('PRICE');

    await request(app)
      .post('/webhooks/instagram')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', signBody(body))
      .send(body)
      .expect(401);
  });

  it('returns 400 for malformed JSON', async () => {
    const { services } = createTestServices();
    const app = createApp(services);
    const body = '{not-json';

    await request(app)
      .post('/webhooks/instagram')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', signBody(body))
      .send(body)
      .expect(400);
  });

  it('acknowledges unknown webhook fields without triggering automation', async () => {
    const { services, instagram } = createTestServices();
    const app = createApp(services);
    const body = JSON.stringify({
      object: 'instagram',
      entry: [
        {
          id: SELF_ACCOUNT_ID,
          time: 1755000000,
          changes: [{ field: 'story_insights', value: { impressions: 5 } }],
        },
      ],
    });

    await request(app)
      .post('/webhooks/instagram')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', signBody(body))
      .send(body)
      .expect(200);

    await settle();
    expect(instagram.sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(instagram.replyToComment).not.toHaveBeenCalled();
    expect(instagram.sendTextMessage).not.toHaveBeenCalled();
  });

  it('acknowledges payloads without an entry array', async () => {
    const { services } = createTestServices();
    const app = createApp(services);
    const body = JSON.stringify({ object: 'instagram' });

    await request(app)
      .post('/webhooks/instagram')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', signBody(body))
      .send(body)
      .expect(200);
  });
});
