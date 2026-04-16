import { describe, expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FileUrlCacheRepo } from '@/infra/persistence/FileUrlCacheRepo';
import { makeTmpDir } from '../../_helpers';

describe('FileUrlCacheRepo', () => {
  test('empty when file does not exist', () => {
    const repo = new FileUrlCacheRepo(join(makeTmpDir(), 'missing.txt'));
    expect(repo.getAll().size).toBe(0);
  });

  test('round-trip via add + getAll', () => {
    const repo = new FileUrlCacheRepo(join(makeTmpDir(), 'cache.txt'));
    repo.add(['https://a.test/1', 'https://a.test/2']);
    const all = repo.getAll();
    expect(all.has('https://a.test/1')).toBe(true);
    expect(all.has('https://a.test/2')).toBe(true);
    expect(all.size).toBe(2);
  });

  test('dedup on repeat add', () => {
    const repo = new FileUrlCacheRepo(join(makeTmpDir(), 'cache.txt'));
    repo.add(['x']);
    repo.add(['x', 'y']);
    expect(repo.getAll().size).toBe(2);
  });

  test('persists across new instance (same path)', () => {
    const p = join(makeTmpDir(), 'cache.txt');
    new FileUrlCacheRepo(p).add(['alpha']);
    expect(new FileUrlCacheRepo(p).getAll().has('alpha')).toBe(true);
  });

  test('ignores blank lines and whitespace', () => {
    const p = join(makeTmpDir(), 'cache.txt');
    writeFileSync(p, '\n  url1  \n\nurl2\n\n', 'utf-8');
    const all = new FileUrlCacheRepo(p).getAll();
    expect(all.has('url1')).toBe(true);
    expect(all.has('url2')).toBe(true);
    expect(all.size).toBe(2);
  });

  test('empty add is a no-op', () => {
    const repo = new FileUrlCacheRepo(join(makeTmpDir(), 'cache.txt'));
    repo.add([]);
    expect(repo.getAll().size).toBe(0);
  });

  test('creates parent dir if missing', () => {
    const p = join(makeTmpDir(), 'nested/deep/cache.txt');
    const repo = new FileUrlCacheRepo(p);
    repo.add(['ok']);
    expect(repo.getAll().has('ok')).toBe(true);
  });
});
