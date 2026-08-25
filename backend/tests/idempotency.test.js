import { describe, expect, it } from 'vitest';
import { InMemoryIdempotencyStore } from '../src/services/events/idempotency.js';
import { ReplyThrottle } from '../src/services/events/reply-throttle.js';

describe('InMemoryIdempotencyStore', () => {
  it('returns true for a new key and false for a duplicate', async () => {
    const store = new InMemoryIdempotencyStore();
    expect(await store.markIfNew('comment:1')).toBe(true);
    expect(await store.markIfNew('comment:1')).toBe(false);
    expect(await store.markIfNew('comment:2')).toBe(true);
  });

  it('allows a key again after its TTL expires', async () => {
    let now = 1_000_000;
    const store = new InMemoryIdempotencyStore(60_000, 10_000, () => now);
    expect(await store.markIfNew('k')).toBe(true);
    now += 30_000;
    expect(await store.markIfNew('k')).toBe(false);
    now += 31_000;
    expect(await store.markIfNew('k')).toBe(true);
  });

  it('evicts oldest entries when the max size is reached', async () => {
    let now = 1_000_000;
    const store = new InMemoryIdempotencyStore(60_000, 2, () => now);
    expect(await store.markIfNew('a')).toBe(true);
    expect(await store.markIfNew('b')).toBe(true);
    expect(await store.markIfNew('c')).toBe(true); // evicts "a"
    expect(await store.markIfNew('a')).toBe(true); // "a" was evicted, so new again
    now += 1;
    expect(await store.markIfNew('c')).toBe(false); // still tracked
  });
});

describe('ReplyThrottle', () => {
  it('blocks sends above the per-window limit and recovers after the window', () => {
    let now = 1_000_000;
    const throttle = new ReplyThrottle(2, 60_000, () => now);
    expect(throttle.allow('user-1')).toBe(true);
    expect(throttle.allow('user-1')).toBe(true);
    expect(throttle.allow('user-1')).toBe(false);
    expect(throttle.allow('user-2')).toBe(true); // other users unaffected
    now += 61_000;
    expect(throttle.allow('user-1')).toBe(true);
  });
});
