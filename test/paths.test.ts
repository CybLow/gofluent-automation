import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';

const PROJECT_DIR = process.cwd();
const EXPR = "import('./src/paths').then(m => console.log(JSON.stringify(m.paths)))";

function runWithEnv(env: Record<string, string>): { DATA_DIR: string; LOGS_DIR: string; SESSION_PATH: string; URL_CACHE_PATH: string } {
  const result = spawnSync('bun', ['-e', EXPR], {
    cwd: PROJECT_DIR,
    env: { ...process.env, ...env, NODE_OPTIONS: '' },
    encoding: 'utf-8',
  });
  if (result.status !== 0) throw new Error(`bun -e failed: ${result.stderr}`);
  return JSON.parse(result.stdout.trim());
}

describe('paths', () => {
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
