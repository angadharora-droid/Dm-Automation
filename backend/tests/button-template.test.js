import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { validateAutomationConfig } from '../src/config/automation.config.js';
import { createTestServices, setBaseTestEnv } from './helpers.js';

const buttonConfig = {
  commentRules: [],
  dmRules: [
    {
      id: 'dm-menu',
      keywords: ['menu', 'price'],
      reply: 'Hey @{username}! Here is everything 👇',
      buttonTitle: 'View Menu & Links',
      buttonUrl: 'https://linktr.ee/MickysByCpFood',
      buttonHeader: "Micky's ❤️",
    },
  ],
  dmFallbackReply: null,
};

function dm(text, mid = 'mid-b1') {
  return {
    sender: { id: 'igsid-b' },
    recipient: { id: 'x' },
    timestamp: 1,
    message: { mid, text },
  };
}

describe('DM button template', () => {
  beforeEach(() => setBaseTestEnv());

  it('sends the text reply followed by the button template', async () => {
    const { services, instagram } = createTestServices(buttonConfig);
    await services.dmAutomation.handleMessagingEvent(dm('what is the menu?'));

    expect(instagram.sendTextMessage).toHaveBeenCalledWith(
      'igsid-b',
      'Hey @somefan! Here is everything 👇',
    );
    expect(instagram.sendButtonTemplate).toHaveBeenCalledWith('igsid-b', {
      header: "Micky's ❤️",
      buttonTitle: 'View Menu & Links',
      buttonUrl: 'https://linktr.ee/MickysByCpFood',
    });
    // Text goes out before the button.
    expect(instagram.sendTextMessage.mock.invocationCallOrder[0]).toBeLessThan(
      instagram.sendButtonTemplate.mock.invocationCallOrder[0],
    );
  });

  it('sends no button for rules without one', async () => {
    const config = {
      ...buttonConfig,
      dmRules: [{ id: 'plain', keywords: ['hi'], reply: 'Hello!' }],
    };
    const { services, instagram } = createTestServices(config);
    await services.dmAutomation.handleMessagingEvent(dm('hi there', 'mid-b2'));
    expect(instagram.sendTextMessage).toHaveBeenCalledWith('igsid-b', 'Hello!');
    expect(instagram.sendButtonTemplate).not.toHaveBeenCalled();
  });
});

describe('button validation', () => {
  beforeEach(() => setBaseTestEnv());

  it('accepts a complete valid button', () => {
    const { errors, config } = validateAutomationConfig(buttonConfig);
    expect(errors).toEqual([]);
    expect(config.dmRules[0].buttonTitle).toBe('View Menu & Links');
  });

  it('rejects a button URL without http(s) and a missing button text', () => {
    const { errors } = validateAutomationConfig({
      commentRules: [],
      dmRules: [
        { id: 'bad', keywords: ['x'], reply: 'r', buttonUrl: 'linktr.ee/foo' },
      ],
    });
    expect(errors.join(' ')).toMatch(/http/);
    expect(errors.join(' ')).toMatch(/button text is required/);
  });

  it('rejects over-long button text', () => {
    const { errors } = validateAutomationConfig({
      commentRules: [],
      dmRules: [
        {
          id: 'long',
          keywords: ['x'],
          reply: 'r',
          buttonTitle: 'This button title is much too long',
          buttonUrl: 'https://example.com',
        },
      ],
    });
    expect(errors.join(' ')).toMatch(/20 characters/);
  });

  it('round-trips through the rules API', async () => {
    process.env.ADMIN_API_KEY = 'btn-admin';
    const { services } = createTestServices();
    const app = createApp(services);
    await request(app)
      .put('/api/dashboard/rules')
      .set('x-admin-key', 'btn-admin')
      .send(buttonConfig)
      .expect(200);
    const res = await request(app)
      .get('/api/dashboard/rules')
      .set('x-admin-key', 'btn-admin')
      .expect(200);
    expect(res.body.dmRules[0].buttonUrl).toBe('https://linktr.ee/MickysByCpFood');
  });
});
