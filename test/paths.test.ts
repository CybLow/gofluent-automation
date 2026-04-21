import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { paths } from '@/paths';

const PROJECT_DIR = process.cwd();
const EXPR = "import('./src/paths').then(m => console.log(JSON.stringify({ DATA_DIR: m.paths.DATA_DIR, LOGS_DIR: m.paths.LOGS_DIR, SESSION_PATH: m.paths.SESSION_PATH, URL_CACHE_PATH: m.paths.URL_CACHE_PATH })))";

interface PathsSnapshot {
  DATA_DIR: string;
  LOGS_DIR: string;
  SESSION_PATH: string;
  URL_CACHE_PATH: string;
}

function runWithEnv(env: Record<string, string>): PathsSnapshot {
  const result = spawnSync('bun', ['-e', EXPR], {
    cwd: PROJECT_DIR,
    env: { ...process.env, ...env, NODE_OPTIONS: '' },
    encoding: 'utf-8',
  });
  if (result.status !== 0) throw new Error(`bun -e failed: ${result.stderr}`);
  return JSON.parse(result.stdout.trim());
}

describe('paths env overrides', () => {
  test('defaults resolve under process.cwd()', () => {
    const p = runWithEnv({ GOFLUENT_DATA_DIR: '', GOFLUENT_LOGS_DIR: '' });
    expect(p.DATA_DIR.endsWith('/data')).toBe(true);
    expect(p.LOGS_DIR.endsWith('/logs')).toBe(true);
    expect(p.SESSION_PATH.endsWith('/data/session.json')).toBe(true);
    expect(p.URL_CACHE_PATH.endsWith('/data/cache.txt')).toBe(true);
  });

  test('GOFLUENT_DATA_DIR override flows through to derived paths', () => {
    const p = runWithEnv({ GOFLUENT_DATA_DIR: '/tmp/gf-x' });
    expect(p.DATA_DIR).toBe('/tmp/gf-x');
    expect(p.SESSION_PATH).toBe('/tmp/gf-x/session.json');
    expect(p.URL_CACHE_PATH).toBe('/tmp/gf-x/cache.txt');
  });

  test('GOFLUENT_LOGS_DIR override independent of DATA_DIR', () => {
    const p = runWithEnv({ GOFLUENT_LOGS_DIR: '/tmp/gf-logs-y' });
    expect(p.LOGS_DIR).toBe('/tmp/gf-logs-y');
    expect(p.DATA_DIR.endsWith('/data')).toBe(true);
  });
});

describe('paths per-profile helpers', () => {
  test('sessionPath(undefined) = data/session.json (default file)', () => {
    expect(paths.sessionPath()).toBe(paths.SESSION_PATH);
    expect(paths.sessionPath().endsWith('/session.json')).toBe(true);
  });

  test('sessionPath("work") = data/session-work.json', () => {
    expect(paths.sessionPath('work').endsWith('/session-work.json')).toBe(true);
  });

  test('sessionPath is case-insensitive (stored as lowercase)', () => {
    expect(paths.sessionPath('WORK')).toBe(paths.sessionPath('work'));
    expect(paths.sessionPath('Work')).toBe(paths.sessionPath('work'));
  });

  test('urlCachePath(undefined) = data/cache.txt (default file)', () => {
    expect(paths.urlCachePath()).toBe(paths.URL_CACHE_PATH);
    expect(paths.urlCachePath().endsWith('/cache.txt')).toBe(true);
  });

  test('urlCachePath("work") = data/cache-work.txt', () => {
    expect(paths.urlCachePath('work').endsWith('/cache-work.txt')).toBe(true);
  });

  test('different profiles yield different files (no collision)', () => {
    expect(paths.sessionPath('work')).not.toBe(paths.sessionPath('perso'));
    expect(paths.urlCachePath('work')).not.toBe(paths.urlCachePath('perso'));
    expect(paths.sessionPath('work')).not.toBe(paths.sessionPath());
  });
});
