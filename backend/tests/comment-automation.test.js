import { beforeEach, describe, expect, it } from 'vitest';
import { createTestServices, setBaseTestEnv, SELF_ACCOUNT_ID } from './helpers.js';

function comment(text, overrides = {}) {
  return {
    id: 'comment-1',
    from: { id: 'user-1', username: 'somefan' },
    media: { id: 'media-1', media_product_type: 'FEED' },
    text,
    ...overrides,
  };
}

describe('CommentAutomationService', () => {
  beforeEach(() => setBaseTestEnv());

  it('sends a private reply and public reply when a keyword matches', async () => {
    const { services, instagram } = createTestServices();
    await services.commentAutomation.handleCommentEvent(comment('What is the PRICE?'));
    expect(instagram.sendPrivateReplyToComment).toHaveBeenCalledWith(
      'comment-1',
      'Test DM message',
    );
    expect(instagram.replyToComment).toHaveBeenCalledWith('comment-1', 'Test public reply');
  });

  it('matches keywords case-insensitively and with punctuation', async () => {
    const { services, instagram } = createTestServices();
    await services.commentAutomation.handleCommentEvent(comment('LINK!!'));
    expect(instagram.sendPrivateReplyToComment).toHaveBeenCalledTimes(1);
  });

  it('does not match keywords embedded inside other words', async () => {
    const { services, instagram } = createTestServices();
    await services.commentAutomation.handleCommentEvent(comment('nicely priced artwork'));
    expect(instagram.sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(instagram.replyToComment).not.toHaveBeenCalled();
  });

  it('ignores comments that match no rule', async () => {
    const { services, instagram } = createTestServices();
    await services.commentAutomation.handleCommentEvent(comment('beautiful shot!'));
    expect(instagram.sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(instagram.replyToComment).not.toHaveBeenCalled();
  });

  it('ignores comments made by our own account (loop protection)', async () => {
    const { services, instagram } = createTestServices();
    await services.commentAutomation.handleCommentEvent(
      comment('price', { from: { id: SELF_ACCOUNT_ID, username: 'me' } }),
    );
    expect(instagram.sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(instagram.replyToComment).not.toHaveBeenCalled();
  });

  it('ignores comments whose text equals one of our reply templates (loop protection)', async () => {
    const { services, instagram } = createTestServices();
    await services.commentAutomation.handleCommentEvent(comment('Test public reply'));
    expect(instagram.sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(instagram.replyToComment).not.toHaveBeenCalled();
  });

  it('processes duplicate comment events only once', async () => {
    const { services, instagram } = createTestServices();
    await services.commentAutomation.handleCommentEvent(comment('price'));
    await services.commentAutomation.handleCommentEvent(comment('price'));
    expect(instagram.sendPrivateReplyToComment).toHaveBeenCalledTimes(1);
    expect(instagram.replyToComment).toHaveBeenCalledTimes(1);
  });

  it('respects per-media rule scoping', async () => {
    const scopedConfig = {
      commentRules: [
        {
          id: 'scoped',
          keywords: ['price'],
          action: 'private_reply',
          dmMessage: 'Scoped DM',
          mediaIds: ['media-99'],
        },
      ],
      dmRules: [],
      dmFallbackReply: null,
    };
    const { services, instagram } = createTestServices(scopedConfig);
    await services.commentAutomation.handleCommentEvent(comment('price'));
    expect(instagram.sendPrivateReplyToComment).not.toHaveBeenCalled();

    await services.commentAutomation.handleCommentEvent(
      comment('price', { id: 'comment-2', media: { id: 'media-99' } }),
    );
    expect(instagram.sendPrivateReplyToComment).toHaveBeenCalledWith('comment-2', 'Scoped DM');
  });

  it('still posts the public reply when the private reply fails', async () => {
    const { services, instagram } = createTestServices();
    instagram.sendPrivateReplyToComment.mockRejectedValueOnce(new Error('already replied'));
    await services.commentAutomation.handleCommentEvent(comment('price'));
    expect(instagram.replyToComment).toHaveBeenCalledTimes(1);
  });
});
