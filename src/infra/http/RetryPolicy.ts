import { MAX_HTTP_RETRIES, RETRY_BASE_MS } from '@/constants';

export function isRetryable(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

export function backoffDelay(attempt: number): number {
  return RETRY_BASE_MS * 2 ** (attempt - 1);
}

export function wait(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export const MAX_ATTEMPTS = MAX_HTTP_RETRIES;
