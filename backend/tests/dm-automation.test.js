import { beforeEach, describe, expect, it } from 'vitest';
import {
  createTestServices,
  setBaseTestEnv,
  SELF_ACCOUNT_ID,
  testAutomationConfig,
} from './helpers.js';

function dm(text, overrides = {}) {
  return {
    sender: { id: 'igsid-42' },
    recipient: { id: SELF_ACCOUNT_ID },
    timestamp: 1755000000000,
    message: { mid: 'mid-1', text },
    ...overrides,
  };
}

describe('DmAutomationService', () => {
  beforeEach(() => setBaseTestEnv());

  it('replies when a DM keyword matches', async () => {
    const { services, instagram } = createTestServices();
    await services.dmAutomation.handleMessagingEvent(dm('Hi, what is the price?'));
    expect(instagram.sendTextMessage).toHaveBeenCalledWith('igsid-42', 'Test DM rule reply');
  });

  it('matches multi-word keyword phrases', async () => {
    const { services, instagram } = createTestServices();
    await services.dmAutomation.handleMessagingEvent(dm('how much does it cost?'));
    expect(instagram.sendTextMessage).toHaveBeenCalledTimes(1);
  });

  it('stays silent for unmatched DMs when no fallback is configured', async () => {
    const { services, instagram } = createTestServices();
    await services.dmAutomation.handleMessagingEvent(dm('good morning'));
    expect(instagram.sendTextMessage).not.toHaveBeenCalled();
  });

  it('uses the fallback reply for unmatched DMs when configured', async () => {
    const config = {
      ...testAutomationConfig,
      dmFallbackReply: 'Thanks for your message, a human will get back to you!',
    };
    const { services, instagram } = createTestServices(config);
    await services.dmAutomation.handleMessagingEvent(dm('good morning'));
    expect(instagram.sendTextMessage).toHaveBeenCalledWith(
      'igsid-42',
      'Thanks for your message, a human will get back to you!',
    );
  });

  it('skips echoes of our own outbound messages (loop protection)', async () => {
    const { services, instagram } = createTestServices();
    await services.dmAutomation.handleMessagingEvent(
      dm('price', { message: { mid: 'mid-echo', text: 'price', is_echo: true } }),
    );
    expect(instagram.sendTextMessage).not.toHaveBeenCalled();
  });

  it('skips messages sent by our own account (loop protection)', async () => {
    const { services, instagram } = createTestServices();
    await services.dmAutomation.handleMessagingEvent(
      dm('price', { sender: { id: SELF_ACCOUNT_ID } }),
    );
    expect(instagram.sendTextMessage).not.toHaveBeenCalled();
  });

  it('processes duplicate message events only once', async () => {
    const { services, instagram } = createTestServices();
    await services.dmAutomation.handleMessagingEvent(dm('price'));
    await services.dmAutomation.handleMessagingEvent(dm('price'));
    expect(instagram.sendTextMessage).toHaveBeenCalledTimes(1);
  });

  it('ignores messaging events without a message (seen/reactions)', async () => {
    const { services, instagram } = createTestServices();
    await services.dmAutomation.handleMessagingEvent({
      sender: { id: 'igsid-42' },
      recipient: { id: SELF_ACCOUNT_ID },
      read: { mid: 'mid-1' },
    });
    expect(instagram.sendTextMessage).not.toHaveBeenCalled();
  });

  it('ignores attachment-only messages without text', async () => {
    const { services, instagram } = createTestServices();
    await services.dmAutomation.handleMessagingEvent(
      dm('', { message: { mid: 'mid-att', attachments: [{ type: 'image' }] } }),
    );
    expect(instagram.sendTextMessage).not.toHaveBeenCalled();
  });
});
