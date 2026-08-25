import { logger } from '../../utils/logger.js';

/**
 * Low-level HTTP client for the Meta Graph API (Instagram Login flavor:
 * https://graph.instagram.com). All outbound Meta calls go through this class
 * so timeouts, retries, rate-limit handling, and safe logging live in one place.
 *
 * The access token is sent via the Authorization header — never in the URL —
 * so request URLs are always safe to log.
 */

export class MetaApiError extends Error {
  /**
   * @param {string} message
   * @param {number|null} status HTTP status, or null for network errors/timeouts.
   * @param {{message?: string, type?: string, code?: number, error_subcode?: number, fbtrace_id?: string}} [graphError]
   */
  constructor(message, status, graphError) {
    super(message);
    this.name = 'MetaApiError';
    this.status = status;
    this.graphError = graphError;
  }

  /** Graph API rate-limit error codes: 4 (app), 17 (user), 613 (custom). */
  get isRateLimited() {
    if (this.status === 429) return true;
    return [4, 17, 613].includes(this.graphError?.code ?? -1);
  }

  get isRetryable() {
    return this.status === null || this.status >= 500 || this.isRateLimited;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MetaApiClient {
  /**
   * @param {{baseUrl: string, apiVersion: string, accessToken?: string,
   *          timeoutMs?: number, maxRetries?: number, fetchFn?: typeof fetch}} options
   */
  constructor(options) {
    this.options = options;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  get(path, query) {
    return this.request('GET', path, { query });
  }

  post(path, body, query) {
    return this.request('POST', path, { body, query });
  }

  async request(method, path, opts = {}) {
    if (!this.options.accessToken) {
      // Permanent configuration problem — never retried.
      throw new MetaApiError(
        'INSTAGRAM_ACCESS_TOKEN is not configured; cannot call the Meta API',
        401,
      );
    }
    let attempt = 0;
    for (;;) {
      try {
        return await this.doRequest(method, path, opts);
      } catch (err) {
        if (err instanceof MetaApiError && err.isRetryable && attempt < this.maxRetries) {
          const delayMs = 500 * 2 ** attempt + Math.floor(Math.random() * 250);
          if (err.isRateLimited) {
            logger.warn('META', `Rate limited by Meta API; backing off ${delayMs}ms`, {
              path,
              code: err.graphError?.code,
            });
          } else {
            logger.warn(
              'META',
              `Meta API request failed (status ${err.status ?? 'network'}); retry ${attempt + 1}/${this.maxRetries}`,
              { path },
            );
          }
          await sleep(delayMs);
          attempt += 1;
          continue;
        }
        throw err;
      }
    }
  }

  buildUrl(path, query) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.options.baseUrl}/${this.options.apiVersion}${normalizedPath}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  async doRequest(method, path, opts) {
    const url = this.buildUrl(path, opts.query);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers = {
        authorization: `Bearer ${this.options.accessToken}`,
      };
      let body;
      if (opts.body !== undefined) {
        headers['content-type'] = 'application/json';
        body = JSON.stringify(opts.body);
      }

      const response = await this.fetchFn(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      const text = await response.text();
      let json;
      try {
        json = text ? JSON.parse(text) : undefined;
      } catch {
        json = undefined;
      }

      this.logUsageHeaders(response, path);

      if (!response.ok) {
        const graphError = json?.error;
        throw new MetaApiError(
          `Meta API ${method} ${path} failed with status ${response.status}` +
            (graphError?.message ? `: ${graphError.message}` : ''),
          response.status,
          graphError,
        );
      }
      return json;
    } catch (err) {
      if (err instanceof MetaApiError) throw err;
      if (err.name === 'AbortError') {
        throw new MetaApiError(
          `Meta API ${method} ${path} timed out after ${this.timeoutMs}ms`,
          null,
        );
      }
      throw new MetaApiError(`Meta API ${method} ${path} network error: ${err.message}`, null);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Surface Meta rate-limit usage headers so throttling is visible before it bites. */
  logUsageHeaders(response, path) {
    const appUsage = response.headers.get('x-app-usage');
    if (!appUsage) return;
    try {
      const usage = JSON.parse(appUsage);
      const maxUsage = Math.max(...Object.values(usage));
      if (Number.isFinite(maxUsage) && maxUsage >= 80) {
        logger.warn('META', `App-level rate limit usage at ${maxUsage}%`, { path });
      }
    } catch {
      // Ignore unparseable usage headers.
    }
  }
}
