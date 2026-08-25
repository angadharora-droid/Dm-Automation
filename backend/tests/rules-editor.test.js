import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTestServices, setBaseTestEnv } from './helpers.js';

const ADMIN = { 'x-admin-key': 'editor-admin-key' };

const validConfig = {
  commentRules: [
    {
      id: 'launch',
      keywords: ['launch', 'drop'],
      action: 'private_and_public_reply',
      dmMessage: 'Here are the launch details!',
      publicReplyMessage: 'Check your inbox! 📩',
      mediaIds: [],
    },
  ],
  dmRules: [{ id: 'dm-hours', keywords: ['hours', 'open'], reply: 'We are open 9-5.' }],
  dmFallbackReply: null,
};

describe('PUT /api/dashboard/rules (dashboard rule editor)', () => {
  beforeEach(() => {
    setBaseTestEnv();
    process.env.ADMIN_API_KEY = 'editor-admin-key';
  });

  it('saves a valid config and returns it from GET', async () => {
    const app = createApp(createTestServices().services);
    const put = await request(app).put('/api/dashboard/rules').set(ADMIN).send(validConfig).expect(200);
    expect(put.body.commentRules).toHaveLength(1);
    expect(put.body.dmRules[0].id).toBe('dm-hours');

    const get = await request(app).get('/api/dashboard/rules').set(ADMIN).expect(200);
    expect(get.body.commentRules[0].keywords).toEqual(['launch', 'drop']);
  });

  it('rejects invalid configs with details', async () => {
    const app = createApp(createTestServices().services);
    const res = await request(app)
      .put('/api/dashboard/rules')
      .set(ADMIN)
      .send({
        commentRules: [{ id: 'bad', keywords: [], action: 'shout_loudly' }],
        dmRules: [{ id: 'bad-dm', keywords: ['x'], reply: '' }],
      })
      .expect(400);
    expect(res.body.error).toBe('Invalid rules');
    expect(res.body.details.join(' ')).toMatch(/action/);
    expect(res.body.details.join(' ')).toMatch(/keyword/);
    expect(res.body.details.join(' ')).toMatch(/reply/i);
  });

  it('rejects duplicate rule names', async () => {
    const app = createApp(createTestServices().services);
    const res = await request(app)
      .put('/api/dashboard/rules')
      .set(ADMIN)
      .send({
        commentRules: [],
        dmRules: [
          { id: 'same', keywords: ['a'], reply: 'A' },
          { id: 'same', keywords: ['b'], reply: 'B' },
        ],
      })
      .expect(400);
    expect(res.body.details.join(' ')).toMatch(/Duplicate/);
  });

  it('requires admin auth', async () => {
    const app = createApp(createTestServices().services);
    await request(app).put('/api/dashboard/rules').send(validConfig).expect(401);
  });

  it('saved rules take effect in the automation immediately', async () => {
    const { services, instagram } = createTestServices();
    const app = createApp(services);
    await request(app).put('/api/dashboard/rules').set(ADMIN).send(validConfig).expect(200);

    await services.commentAutomation.handleCommentEvent({
      id: 'comment-editor-1',
      from: { id: 'user-9', username: 'fan' },
      media: { id: 'media-9' },
      text: 'When is the LAUNCH?',
    });
    expect(instagram.sendPrivateReplyToComment).toHaveBeenCalledWith(
      'comment-editor-1',
      'Here are the launch details!',
    );

    await services.dmAutomation.handleMessagingEvent({
      sender: { id: 'igsid-9' },
      recipient: { id: 'x' },
      timestamp: 1,
      message: { mid: 'mid-editor-1', text: 'what are your hours?' },
    });
    expect(instagram.sendTextMessage).toHaveBeenCalledWith('igsid-9', 'We are open 9-5.');
  });
});
