import { describe, expect, test } from 'bun:test';
import type { Page } from 'playwright';
import { TokenCaptureService } from '@/auth/TokenCaptureService';
import { NullLogger, makeJwt } from '../_helpers';

type ReqHandler = (req: FakeRequest) => void;

interface FakeRequest {
  headers(): Record<string, string>;
  method(): string;
  url(): string;
}

function fakePage(): { page: Page; emit: (req: FakeRequest) => void } {
  let handler: ReqHandler = () => {};
  const page = {
    on: (event: string, cb: ReqHandler) => {
      if (event === 'request') handler = cb;
    },
  } as unknown as Page;
  return { page, emit: (req) => handler(req) };
}

function fakeReq(token: string, url = 'https://x.test/api/a'): FakeRequest {
  return {
    headers: () => (token ? { authorization: token } : {}),
    method: () => 'GET',
    url: () => url,
  };
}

function nowSec(): number { return Math.floor(Date.now() / 1000); }

describe('TokenCaptureService', () => {
  test('captures a fresh Bearer on the first matching request', () => {
    const { page, emit } = fakePage();
    const svc = new TokenCaptureService(new NullLogger());
    svc.attach(page);
    expect(svc.isReady()).toBe(false);

    const fresh = 'Bearer ' + makeJwt({ sub: 'u1', exp: nowSec() + 3600 });
    emit(fakeReq(fresh));
    expect(svc.isReady()).toBe(true);
    expect(svc.getToken()).toBe(fresh);
    expect(svc.getUserId()).toBe('u1');
  });

  test('ignores requests without a Bearer header', () => {
    const { page, emit } = fakePage();
    const svc = new TokenCaptureService(new NullLogger());
    svc.attach(page);
    emit(fakeReq(''));
    emit(fakeReq('Basic dXNlcjpwYXNz'));
    expect(svc.isReady()).toBe(false);
  });

  test('skips stale token, captures the later fresh one', () => {
    const { page, emit } = fakePage();
    const svc = new TokenCaptureService(new NullLogger());
    svc.attach(page);

    const stale = 'Bearer ' + makeJwt({ sub: 'old', exp: nowSec() - 600 });
    const fresh = 'Bearer ' + makeJwt({ sub: 'new', exp: nowSec() + 7200 });

    emit(fakeReq(stale, 'https://x.test/api/v1.0/jwt/auth/continue'));
    expect(svc.isReady()).toBe(false);

    emit(fakeReq(fresh, 'https://x.test/api/topic'));
    expect(svc.isReady()).toBe(true);
    expect(svc.getToken()).toBe(fresh);
    expect(svc.getUserId()).toBe('new');
  });

  test('skips token about to expire (within 60s margin)', () => {
    const { page, emit } = fakePage();
    const svc = new TokenCaptureService(new NullLogger());
    svc.attach(page);
    const nearExpired = 'Bearer ' + makeJwt({ sub: 'near', exp: nowSec() + 30 });
    emit(fakeReq(nearExpired));
    expect(svc.isReady()).toBe(false);
  });

  test('still captures when token has no exp claim (fallback=0 path)', () => {
    const { page, emit } = fakePage();
    const svc = new TokenCaptureService(new NullLogger());
    svc.attach(page);
    const noExp = 'Bearer ' + makeJwt({ sub: 'anon' });
    emit(fakeReq(noExp));
    expect(svc.isReady()).toBe(true);
    expect(svc.getUserId()).toBe('anon');
  });

  test('stops capturing after first success (does not overwrite)', () => {
    const { page, emit } = fakePage();
    const svc = new TokenCaptureService(new NullLogger());
    svc.attach(page);
    const first = 'Bearer ' + makeJwt({ sub: 'first', exp: nowSec() + 3600 });
    const second = 'Bearer ' + makeJwt({ sub: 'second', exp: nowSec() + 3600 });
    emit(fakeReq(first));
    emit(fakeReq(second));
    expect(svc.getToken()).toBe(first);
    expect(svc.getUserId()).toBe('first');
  });
});
