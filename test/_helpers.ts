import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ILogger } from '@/infra/logging/ILogger';

export class NullLogger implements ILogger {
  step(): void {}
  success(): void {}
  warn(): void {}
  error(): void {}
  info(): void {}
  line(): void {}
  debug(): void {}
  close(): void {}
}

export function makeTmpDir(prefix = 'gf-test-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function b64url(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function makeJwt(payload: Record<string, unknown>): string {
  const header = b64url({ alg: 'none', typ: 'JWT' });
  const body = b64url(payload);
  return `${header}.${body}.`;
}
