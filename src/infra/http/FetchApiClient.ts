import type { ILogger } from '@/infra/logging/ILogger';
import type { ITokenCache } from '@/infra/persistence/ITokenCache';
import type { IApiClient } from './IApiClient';
import { MAX_ATTEMPTS, backoffDelay, isRetryable, wait } from './RetryPolicy';

type HttpMethod = 'GET' | 'POST';

export class FetchApiClient implements IApiClient {
  private readonly headers: Record<string, string>;

  constructor(
    public readonly base: string,
    token: string,
    private readonly tokenCache: ITokenCache,
    private readonly logger: ILogger,
  ) {
    this.headers = {
      Authorization: token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async get<T = unknown>(path: string): Promise<T> {
    this.logger.debug(`GET ${path}`);
    const resp = await this.fetchWithRetry('GET', path);
    await this.assertOk(resp, 'GET', path);
    return resp.json() as Promise<T>;
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    this.logger.debug(`POST ${path}`);
    const resp = await this.fetchWithRetry('POST', path, body);
    await this.assertOk(resp, 'POST', path);
    const text = await resp.text();
    try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
  }

  async postRaw(path: string, body: unknown): Promise<Response> {
    this.logger.debug(`POST ${path}`);
    const resp = await this.fetchWithRetry('POST', path, body);
    await this.assertOk(resp, 'POST', path);
    return resp;
  }

  private async fetchWithRetry(method: HttpMethod, path: string, body?: unknown): Promise<Response> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const resp = await fetch(this.base + path, {
        method,
        headers: this.headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (resp.ok || !isRetryable(resp.status) || attempt === MAX_ATTEMPTS) return resp;
      const delay = backoffDelay(attempt);
      this.logger.debug(`${method} ${path} → ${resp.status}, retry ${attempt}/${MAX_ATTEMPTS - 1} in ${delay}ms`);
      await wait(delay);
    }
    throw new Error('unreachable');
  }

  private async assertOk(resp: Response, method: HttpMethod, path: string): Promise<void> {
    if (resp.ok) return;
    if (resp.status === 401 || resp.status === 403) {
      this.tokenCache.clear();
      this.logger.warn(`Token rejected (${resp.status}) — cache cleared, rerun to re-authenticate`);
    }
    const text = await resp.text().catch(() => '');
    throw new Error(`${method} ${path}: ${resp.status} ${text.slice(0, 200)}`);
  }
}
