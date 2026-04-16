import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { Logger } from './logger.js';

const TOKEN_CACHE_PATH = join(process.cwd(), 'data/auth/token.json');
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 300;

export interface ApiClient {
  base: string;
  get<T = any>(path: string): Promise<T>;
  post<T = any>(path: string, body: unknown): Promise<T>;
  postRaw(path: string, body: unknown): Promise<Response>;
}

function isRetryable(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function wait(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export function createApi(base: string, token: string, logger: Logger): ApiClient {
  const headers = { Authorization: token, 'Content-Type': 'application/json', Accept: 'application/json' };

  async function assertOk(resp: Response, method: string, path: string): Promise<void> {
    if (resp.ok) return;
    if (resp.status === 401 || resp.status === 403) {
      if (existsSync(TOKEN_CACHE_PATH)) {
        unlinkSync(TOKEN_CACHE_PATH);
        logger.warn(`Token rejected (${resp.status}) — cache cleared, rerun to re-authenticate`);
      }
    }
    const text = await resp.text().catch(() => '');
    throw new Error(`${method} ${path}: ${resp.status} ${text.slice(0, 200)}`);
  }

  async function fetchWithRetry(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<Response> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const resp = await fetch(base + path, {
        method, headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (resp.ok || !isRetryable(resp.status) || attempt === MAX_RETRIES) return resp;
      const delay = RETRY_BASE_MS * 2 ** (attempt - 1);
      logger.debug(`${method} ${path} → ${resp.status}, retry ${attempt}/${MAX_RETRIES - 1} in ${delay}ms`);
      await wait(delay);
    }
    throw new Error('unreachable');
  }

  return {
    base,
    async get<T = any>(path: string): Promise<T> {
      logger.debug(`GET ${path}`);
      const resp = await fetchWithRetry('GET', path);
      await assertOk(resp, 'GET', path);
      return resp.json() as Promise<T>;
    },
    async post<T = any>(path: string, body: unknown): Promise<T> {
      logger.debug(`POST ${path}`);
      const resp = await fetchWithRetry('POST', path, body);
      await assertOk(resp, 'POST', path);
      const text = await resp.text();
      try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
    },
    async postRaw(path: string, body: unknown): Promise<Response> {
      logger.debug(`POST ${path}`);
      const resp = await fetchWithRetry('POST', path, body);
      await assertOk(resp, 'POST', path);
      return resp;
    },
  };
}
