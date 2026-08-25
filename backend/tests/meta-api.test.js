import { describe, expect, it, vi } from 'vitest';
import { MetaApiClient, MetaApiError } from '../src/services/meta/meta-api.service.js';
import { truncateUtf8Bytes } from '../src/services/meta/instagram.service.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeClient(fetchFn, maxRetries = 2) {
  return new MetaApiClient({
    baseUrl: 'https://graph.instagram.com',
    apiVersion: 'v25.0',
    accessToken: 'token-123',
    timeoutMs: 500,
    maxRetries,
    fetchFn,
  });
}

describe('MetaApiClient', () => {
  it('sends the access token in the Authorization header, never the URL', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { id: '1' }));
    const client = makeClient(fetchMock);
    await client.post('/me/messages', { recipient: { id: 'x' }, message: { text: 'hi' } });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://graph.instagram.com/v25.0/me/messages');
    expect(url).not.toContain('token-123');
    expect(init.headers.authorization).toBe('Bearer token-123');
  });

  it('throws MetaApiError with Graph error details on 4xx and does not retry', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(400, { error: { message: 'Invalid parameter', code: 100 } }),
    );
    const client = makeClient(fetchMock);
    await expect(client.get('/me')).rejects.toMatchObject({
      name: 'MetaApiError',
      status: 400,
      graphError: { code: 100 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries on 5xx and succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { error: { message: 'server error' } }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'ok' }));
    const client = makeClient(fetchMock);
    const result = await client.get('/me');
    expect(result.id).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('flags Graph rate-limit error codes as rate limited', () => {
    const err = new MetaApiError('limited', 200, { code: 4 });
    expect(err.isRateLimited).toBe(true);
    expect(err.isRetryable).toBe(true);
    expect(new MetaApiError('nope', 400, { code: 100 }).isRateLimited).toBe(false);
  });

  it('fails fast when no access token is configured', async () => {
    const fetchMock = vi.fn();
    const client = new MetaApiClient({
      baseUrl: 'https://graph.instagram.com',
      apiVersion: 'v25.0',
      fetchFn: fetchMock,
    });
    await expect(client.get('/me')).rejects.toThrow(/INSTAGRAM_ACCESS_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('truncateUtf8Bytes', () => {
  it('leaves short text untouched', () => {
    expect(truncateUtf8Bytes('hello')).toBe('hello');
  });

  it('truncates to the byte limit without splitting characters', () => {
    const long = '🙂'.repeat(300); // 4 bytes each = 1200 bytes
    const truncated = truncateUtf8Bytes(long, 1000);
    expect(Buffer.byteLength(truncated, 'utf8')).toBeLessThanOrEqual(1000);
    expect(truncated).not.toContain('�');
    expect(truncated.length).toBeGreaterThan(0);
  });
});
