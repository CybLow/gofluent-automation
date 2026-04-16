import { describe, expect, test } from 'bun:test';
import { backoffDelay, isRetryable, MAX_ATTEMPTS } from '@/infra/http/RetryPolicy';

describe('isRetryable', () => {
  test('429 is retryable', () => {
    expect(isRetryable(429)).toBe(true);
  });

  test('5xx is retryable', () => {
    for (const s of [500, 502, 503, 504, 599]) expect(isRetryable(s)).toBe(true);
  });

  test('4xx (except 429) is not retryable', () => {
    for (const s of [400, 401, 403, 404, 409, 422]) expect(isRetryable(s)).toBe(false);
  });

  test('2xx/3xx are not retryable', () => {
    for (const s of [200, 201, 301, 304]) expect(isRetryable(s)).toBe(false);
  });

  test('600+ is not retryable', () => {
    expect(isRetryable(600)).toBe(false);
  });
});

describe('backoffDelay', () => {
  test('attempt 1 = base', () => {
    expect(backoffDelay(1)).toBe(300);
  });

  test('doubles each attempt', () => {
    expect(backoffDelay(2)).toBe(600);
    expect(backoffDelay(3)).toBe(1200);
    expect(backoffDelay(4)).toBe(2400);
  });
});

describe('MAX_ATTEMPTS', () => {
  test('at least 1', () => {
    expect(MAX_ATTEMPTS).toBeGreaterThanOrEqual(1);
  });
});
