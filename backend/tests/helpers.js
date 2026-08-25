import { createHmac } from 'node:crypto';
import { vi } from 'vitest';
import { CommentAutomationService } from '../src/services/automation/comment-automation.service.js';
import { DmAutomationService } from '../src/services/automation/dm-automation.service.js';
import { RuleBasedReplyGenerator } from '../src/services/automation/reply-generator.js';
import { InMemoryRuleStore } from '../src/services/automation/rule-store.js';
import { ActivityLog } from '../src/services/events/activity-log.js';
import { InMemoryIdempotencyStore } from '../src/services/events/idempotency.js';
import { ReplyThrottle } from '../src/services/events/reply-throttle.js';

export const TEST_APP_SECRET = 'test-app-secret';
export const TEST_VERIFY_TOKEN = 'test-verify-token';
export const SELF_ACCOUNT_ID = '17841400000000000';

export function setBaseTestEnv() {
  process.env.NODE_ENV = 'test';
  process.env.META_APP_SECRET = TEST_APP_SECRET;
  process.env.META_VERIFY_TOKEN = TEST_VERIFY_TOKEN;
  process.env.INSTAGRAM_ACCESS_TOKEN = 'test-access-token';
  process.env.INSTAGRAM_ACCOUNT_ID = SELF_ACCOUNT_ID;
  process.env.LOG_LEVEL = 'error';
  delete process.env.AUTOMATION_RULES;
  delete process.env.ADMIN_API_KEY;
  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.SESSION_SECRET;
  delete process.env.MONGODB_URI;
}

export function signBody(body, secret = TEST_APP_SECRET) {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;
}

export function createInstagramServiceMock() {
  return {
    getAccountInfo: vi.fn(async () => ({ user_id: SELF_ACCOUNT_ID, username: 'testaccount' })),
    getRecentMedia: vi.fn(async () => ({
      data: [
        {
          id: '17900000000000001',
          caption: 'Launch day! Comment PRICE for details',
          media_type: 'IMAGE',
          media_url: 'https://scontent.example/img1.jpg',
          permalink: 'https://www.instagram.com/p/abc123/',
          timestamp: '2026-08-20T10:00:00+0000',
          like_count: 42,
          comments_count: 7,
        },
      ],
    })),
    replyToComment: vi.fn(async () => ({ id: 'new-comment-id' })),
    sendPrivateReplyToComment: vi.fn(async () => ({ recipient_id: 'r', message_id: 'm' })),
    sendTextMessage: vi.fn(async () => ({ recipient_id: 'r', message_id: 'm' })),
    subscribeToWebhookFields: vi.fn(async () => ({ success: true })),
  };
}

export const testAutomationConfig = {
  commentRules: [
    {
      id: 'rule-interest',
      keywords: ['price', 'info', 'details', 'buy', 'link'],
      action: 'private_and_public_reply',
      dmMessage: 'Test DM message',
      publicReplyMessage: 'Test public reply',
    },
  ],
  dmRules: [{ id: 'dm-price', keywords: ['price', 'how much'], reply: 'Test DM rule reply' }],
  dmFallbackReply: null,
};

export function createTestServices(configOverride) {
  const instagram = createInstagramServiceMock();
  const config = configOverride ?? testAutomationConfig;
  const ruleStore = new InMemoryRuleStore(config);
  const idempotency = new InMemoryIdempotencyStore();
  // Generous throttle so it never interferes outside dedicated throttle tests.
  const throttle = new ReplyThrottle(1000, 60_000);
  const activity = new ActivityLog();

  const services = {
    instagramService: instagram,
    activity,
    ruleStore,
    databaseConnected: false,
    commentAutomation: new CommentAutomationService({
      instagram,
      idempotency,
      throttle,
      rules: ruleStore,
      selfAccountId: SELF_ACCOUNT_ID,
      activity,
    }),
    dmAutomation: new DmAutomationService({
      instagram,
      idempotency,
      throttle,
      generator: new RuleBasedReplyGenerator(ruleStore),
      selfAccountId: SELF_ACCOUNT_ID,
      activity,
    }),
  };
  return { services, instagram, activity, ruleStore };
}
