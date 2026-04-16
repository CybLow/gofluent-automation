import { describe, expect, test } from 'bun:test';
import { JwtDecoder } from '@/auth/JwtDecoder';
import { makeJwt } from '../_helpers';

const decoder = new JwtDecoder();

describe('JwtDecoder.decode', () => {
  test('decodes valid JWT with sub and exp', () => {
    const jwt = makeJwt({ sub: 'user-123', exp: 1_700_000_000 });
    const p = decoder.decode(jwt);
    expect(p.sub).toBe('user-123');
    expect(p.exp).toBe(1_700_000_000);
  });

  test('strips Bearer prefix', () => {
    const jwt = 'Bearer ' + makeJwt({ sub: 'u1' });
    expect(decoder.decode(jwt).sub).toBe('u1');
  });

  test('empty string returns empty object', () => {
    expect(decoder.decode('')).toEqual({});
  });

  test('garbage returns empty object', () => {
    expect(decoder.decode('not.a.jwt')).toEqual({});
  });
});

describe('JwtDecoder.extractUserId', () => {
  test('returns sub when present', () => {
    expect(decoder.extractUserId(makeJwt({ sub: 's1', uuid: 'u1', userId: 'i1' }))).toBe('s1');
  });

  test('falls back to uuid', () => {
    expect(decoder.extractUserId(makeJwt({ uuid: 'u1', userId: 'i1' }))).toBe('u1');
  });

  test('falls back to userId', () => {
    expect(decoder.extractUserId(makeJwt({ userId: 'i1' }))).toBe('i1');
  });

  test('empty when no identity claims', () => {
    expect(decoder.extractUserId(makeJwt({ foo: 'bar' }))).toBe('');
  });
});

describe('JwtDecoder.extractExpiry', () => {
  test('returns exp when present', () => {
    expect(decoder.extractExpiry(makeJwt({ exp: 999 }), 42)).toBe(999);
  });

  test('returns fallback when exp missing', () => {
    expect(decoder.extractExpiry(makeJwt({}), 42)).toBe(42);
  });

  test('returns fallback when exp not a number', () => {
    expect(decoder.extractExpiry(makeJwt({ exp: 'soon' }), 99)).toBe(99);
  });
});
