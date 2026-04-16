import { describe, expect, test } from 'bun:test';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FileTokenCache } from '@/infra/persistence/FileTokenCache';
import type { StorageState } from '@/infra/persistence/ITokenCache';
import { makeTmpDir, NullLogger } from '../../_helpers';

const logger = new NullLogger();
function nowSec(): number { return Math.floor(Date.now() / 1000); }

const FAKE_STATE: StorageState = {
  cookies: [{
    name: 'session', value: 'abc', domain: '.example.com', path: '/',
    expires: -1, httpOnly: true, secure: true, sameSite: 'Lax',
  }],
  origins: [],
};

describe('FileTokenCache', () => {
  test('missing file returns null', () => {
    const cache = new FileTokenCache(join(makeTmpDir(), 'session.json'), logger);
    expect(cache.load()).toBeNull();
    expect(cache.loadStorageState()).toBeNull();
  });

  test('round-trip save/load', () => {
    const p = join(makeTmpDir(), 'session.json');
    new FileTokenCache(p, logger).save({
      token: 'bearer-xyz', userId: 'user-1', exp: nowSec() + 3600,
    });
    const loaded = new FileTokenCache(p, logger).load();
    expect(loaded?.token).toBe('bearer-xyz');
    expect(loaded?.userId).toBe('user-1');
  });

  test('expired entry returns null from load(), but storage-state still readable', () => {
    const p = join(makeTmpDir(), 'session.json');
    const cache = new FileTokenCache(p, logger);
    cache.save({ token: 't', userId: 'u', exp: nowSec() + 30, storageState: FAKE_STATE });
    expect(cache.load()).toBeNull();
    expect(cache.loadStorageState()?.cookies).toHaveLength(1);
  });

  test('storageState persists and loads via loadStorageState()', () => {
    const p = join(makeTmpDir(), 'session.json');
    const cache = new FileTokenCache(p, logger);
    cache.save({ token: 't', userId: 'u', exp: nowSec() + 3600, storageState: FAKE_STATE });
    const state = cache.loadStorageState();
    expect(state?.cookies[0].name).toBe('session');
    expect(state?.origins).toEqual([]);
  });

  test('loadStorageState returns null when entry has no storageState field', () => {
    const p = join(makeTmpDir(), 'session.json');
    new FileTokenCache(p, logger).save({ token: 't', userId: 'u', exp: nowSec() + 3600 });
    expect(new FileTokenCache(p, logger).loadStorageState()).toBeNull();
  });

  test('clear() removes the file', () => {
    const p = join(makeTmpDir(), 'session.json');
    const cache = new FileTokenCache(p, logger);
    cache.save({ token: 't', userId: 'u', exp: nowSec() + 3600 });
    expect(existsSync(p)).toBe(true);
    cache.clear();
    expect(existsSync(p)).toBe(false);
  });

  test('clear() is idempotent when file missing', () => {
    const p = join(makeTmpDir(), 'session.json');
    expect(() => new FileTokenCache(p, logger).clear()).not.toThrow();
  });

  test('corrupt JSON returns null from load() and loadStorageState()', () => {
    const p = join(makeTmpDir(), 'session.json');
    writeFileSync(p, '{not valid json', 'utf-8');
    const cache = new FileTokenCache(p, logger);
    expect(cache.load()).toBeNull();
    expect(cache.loadStorageState()).toBeNull();
  });

  test('creates parent dir when saving', () => {
    const p = join(makeTmpDir(), 'nested/dir/session.json');
    new FileTokenCache(p, logger).save({ token: 't', userId: 'u', exp: nowSec() + 3600 });
    expect(existsSync(p)).toBe(true);
  });
});
