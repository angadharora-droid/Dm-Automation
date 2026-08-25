import { beforeEach, describe, expect, it } from 'vitest';
import { renderTemplate, templateNeedsProfile } from '../src/services/automation/template.js';
import { createTestServices, setBaseTestEnv, testAutomationConfig } from './helpers.js';

describe('renderTemplate', () => {
  it('replaces {username} with the actual username', () => {
    expect(renderTemplate('Hey @{username}! Thanks!', { username: 'somefan' })).toBe(
      'Hey @somefan! Thanks!',
    );
  });

  it('degrades gracefully when the username is unknown', () => {
    expect(renderTemplate('Hey @{username}!', {})).toBe('Hey there!');
    expect(renderTemplate('Hi {username}, welcome', { username: '  ' })).toBe(
      'Hi there, welcome',
    );
  });

  it('supports {name} with username fallback', () => {
    expect(renderTemplate('Hi {name}!', { name: 'Some Fan' })).toBe('Hi Some Fan!');
    expect(renderTemplate('Hi {name}!', { username: 'somefan' })).toBe('Hi somefan!');
    expect(renderTemplate('Hi {name}!', {})).toBe('Hi there!');
  });

  it('leaves plain text untouched', () => {
    expect(renderTemplate('No placeholders here', { username: 'x' })).toBe('No placeholders here');
  });
});

describe('templateNeedsProfile', () => {
  it('detects placeholders', () => {
    expect(templateNeedsProfile('Hey @{username}')).toBe(true);
    expect(templateNeedsProfile('Hi {name}')).toBe(true);
    expect(templateNeedsProfile('plain reply')).toBe(false);
  });
});

describe('personalized replies end-to-end', () => {
  beforeEach(() => setBaseTestEnv());

  const personalizedConfig = {
    commentRules: [
      {
        id: 'personal',
        keywords: ['price'],
        action: 'private_and_public_reply',
        dmMessage: 'Hey @{username}, details incoming!',
        publicReplyMessage: 'Sent you a DM @{username}!',
      },
    ],
    dmRules: [{ id: 'dm-personal', keywords: ['hello'], reply: 'Hi @{username}, welcome!' }],
    dmFallbackReply: null,
  };

  it('uses the commenter username from the webhook payload', async () => {
    const { services, instagram } = createTestServices(personalizedConfig);
    await services.commentAutomation.handleCommentEvent({
      id: 'comment-p1',
      from: { id: 'user-1', username: 'micky_fan' },
      media: { id: 'media-1' },
      text: 'price?',
    });
    expect(instagram.sendPrivateReplyToComment).toHaveBeenCalledWith(
      'comment-p1',
      'Hey @micky_fan, details incoming!',
    );
    expect(instagram.replyToComment).toHaveBeenCalledWith('comment-p1', 'Sent you a DM @micky_fan!');
    // Comment personalization never needs a profile lookup.
    expect(instagram.getUserProfile).not.toHaveBeenCalled();
  });

  it('falls back to "there" when the webhook has no username', async () => {
    const { services, instagram } = createTestServices(personalizedConfig);
    await services.commentAutomation.handleCommentEvent({
      id: 'comment-p2',
      from: { id: 'user-2' },
      media: { id: 'media-1' },
      text: 'price?',
    });
    expect(instagram.sendPrivateReplyToComment).toHaveBeenCalledWith(
      'comment-p2',
      'Hey there, details incoming!',
    );
  });

  it('fetches the sender profile for personalized DM replies and caches it', async () => {
    const { services, instagram } = createTestServices(personalizedConfig);
    await services.dmAutomation.handleMessagingEvent({
      sender: { id: 'igsid-7' },
      recipient: { id: 'x' },
      timestamp: 1,
      message: { mid: 'mid-p1', text: 'hello!' },
    });
    expect(instagram.getUserProfile).toHaveBeenCalledWith('igsid-7');
    expect(instagram.sendTextMessage).toHaveBeenCalledWith('igsid-7', 'Hi @somefan, welcome!');

    await services.dmAutomation.handleMessagingEvent({
      sender: { id: 'igsid-7' },
      recipient: { id: 'x' },
      timestamp: 2,
      message: { mid: 'mid-p2', text: 'hello again' },
    });
    expect(instagram.getUserProfile).toHaveBeenCalledTimes(1); // cached
  });

  it('still replies with a graceful fallback when the profile lookup fails', async () => {
    const { services, instagram } = createTestServices(personalizedConfig);
    instagram.getUserProfile.mockRejectedValueOnce(new Error('consent required'));
    await services.dmAutomation.handleMessagingEvent({
      sender: { id: 'igsid-8' },
      recipient: { id: 'x' },
      timestamp: 1,
      message: { mid: 'mid-p3', text: 'hello?' },
    });
    expect(instagram.sendTextMessage).toHaveBeenCalledWith('igsid-8', 'Hi there, welcome!');
  });

  it('does not fetch profiles for replies without placeholders', async () => {
    const { services, instagram } = createTestServices(testAutomationConfig);
    await services.dmAutomation.handleMessagingEvent({
      sender: { id: 'igsid-9' },
      recipient: { id: 'x' },
      timestamp: 1,
      message: { mid: 'mid-p4', text: 'what is the price?' },
    });
    expect(instagram.getUserProfile).not.toHaveBeenCalled();
    expect(instagram.sendTextMessage).toHaveBeenCalledWith('igsid-9', 'Test DM rule reply');
  });
});
