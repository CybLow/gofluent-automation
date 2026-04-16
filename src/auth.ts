import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { platform } from 'node:os';
import chalk from 'chalk';
import type { AppConfig } from './types.js';
import type { Logger } from './logger.js';
import { siteBase } from './config.js';

const AUTH_DIR = join(process.cwd(), 'data/auth');
const STORAGE_PATH = join(AUTH_DIR, 'storage-state.json');
const TOKEN_CACHE_PATH = join(AUTH_DIR, 'token.json');
const LOGIN_TIMEOUT_MS = 180_000;
const TOKEN_CAPTURE_TIMEOUT_MS = 30_000;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export interface AuthResult { token: string; userId: string; }

// ── Token cache (JWT persistence) ──────────────────────────────────────────

interface TokenCache { token: string; userId: string; exp: number }

function decodeJwt(jwt: string): { sub?: string; uuid?: string; userId?: string; exp?: number } {
  try {
    const raw = jwt.replaceAll(/^Bearer\s+/gi, '');
    return JSON.parse(Buffer.from(raw.split('.')[1], 'base64').toString());
  } catch { return {}; }
}

function loadTokenCache(logger: Logger): TokenCache | null {
  if (!existsSync(TOKEN_CACHE_PATH)) return null;
  try {
    const cached: TokenCache = JSON.parse(readFileSync(TOKEN_CACHE_PATH, 'utf-8'));
    const remaining = cached.exp - Math.floor(Date.now() / 1000);
    if (remaining > 60) {
      logger.debug(`Cached token valid for ${Math.floor(remaining / 60)}min`);
      return cached;
    }
  } catch (e) { logger.debug(`Token cache read failed: ${e}`); }
  return null;
}

function saveTokenCache(token: string, userId: string): void {
  const payload = decodeJwt(token);
  const exp = typeof payload.exp === 'number' ? payload.exp : Math.floor(Date.now() / 1000) + 3600;
  mkdirSync(AUTH_DIR, { recursive: true });
  writeFileSync(TOKEN_CACHE_PATH, JSON.stringify({ token, userId, exp }), 'utf-8');
}

// ── Browser launch (OS-adaptive) ───────────────────────────────────────────

function preferredChannels(): string[] {
  switch (platform()) {
    case 'darwin': return ['chrome', 'msedge'];
    case 'win32': return ['msedge', 'chrome'];
    default: return ['chrome'];
  }
}

async function launchBrowser(logger: Logger): Promise<Browser> {
  const os = platform();
  const channels = preferredChannels();
  const args = ['--disable-blink-features=AutomationControlled'];

  for (const channel of channels) {
    try {
      const browser = await chromium.launch({ headless: true, channel, args });
      logger.debug(`System browser: ${channel} (${os})`);
      return browser;
    } catch { /* try next */ }
  }
  logger.debug(`Bundled Chromium (${os})`);
  return chromium.launch({ headless: true, args });
}

// ── State detection ────────────────────────────────────────────────────────

type AuthState =
  | 'dashboard'
  | 'saml-domain'
  | 'ms-username'
  | 'ms-password'
  | 'ms-mfa-number'
  | 'ms-mfa-method-picker'
  | 'ms-mfa-approve-waiting'
  | 'ms-stay-signed-in'
  | 'ms-cred-error'
  | 'loading';

interface DetectedState { kind: AuthState; number?: string }

function isTerminalDashboardUrl(url: string, base: string): boolean {
  if (!url.includes(`${base}/app/`)) return false;
  return !/\/app\/(login|samlconnector|oauth|saml|callback)/i.test(url);
}

async function isVisibleAndEnabled(page: Page, selector: string): Promise<boolean> {
  const el = page.locator(selector).first();
  return (await el.isVisible().catch(() => false))
    && (await el.isEnabled().catch(() => false));
}

async function detectMfaNumber(page: Page): Promise<string | null> {
  const text = await page.locator('#idRichContext_DisplaySign, #displaySign')
    .first().textContent({ timeout: 300 }).catch(() => null);
  if (!text) return null;
  const digits = text.replaceAll(/\D/g, '').trim();
  return digits.length >= 2 && digits.length <= 3 ? digits : null;
}

async function detectMfaPage(page: Page): Promise<AuthState | null> {
  if (!await page.locator('#idDiv_SAOTCS_Title').isVisible().catch(() => false)) return null;
  if (await page.getByText(/Approve a request on.*Authenticator/i).first().isVisible().catch(() => false)) {
    return 'ms-mfa-method-picker';
  }
  const waiting = /Open your Authenticator app|waiting for|approve the sign.?in|Authenticator app and (tap|approve)/i;
  if (await page.getByText(waiting).first().isVisible().catch(() => false)) {
    return 'ms-mfa-approve-waiting';
  }
  return null;
}

async function detectState(page: Page, base: string): Promise<DetectedState> {
  const url = page.url();
  if (isTerminalDashboardUrl(url, base)) return { kind: 'dashboard' };

  if (url.includes('portal.gofluent.com/login/samlconnector')
    && await isVisibleAndEnabled(page, '#outlined-size-normal, input[type="text"]')) {
    return { kind: 'saml-domain' };
  }

  if (await page.getByText(/Your account or password is incorrect|account or password/i)
    .first().isVisible().catch(() => false)) return { kind: 'ms-cred-error' };

  if (await page.locator('#KmsiCheckboxField, input[name="DontShowAgain"]')
    .first().isVisible().catch(() => false)) return { kind: 'ms-stay-signed-in' };

  const mfaNum = await detectMfaNumber(page);
  if (mfaNum) return { kind: 'ms-mfa-number', number: mfaNum };

  const mfaState = await detectMfaPage(page);
  if (mfaState) return { kind: mfaState };

  if (await isVisibleAndEnabled(page, '#i0116, input[type="email"]')) return { kind: 'ms-username' };
  if (await isVisibleAndEnabled(page, '#i0118')) return { kind: 'ms-password' };

  return { kind: 'loading' };
}

// ── State handlers ─────────────────────────────────────────────────────────

interface LoopContext {
  page: Page;
  config: AppConfig;
  logger: Logger;
  shownMfa: Set<string>;
  flags: { samlSubmitted: boolean; emailEntered: boolean; credsEntered: boolean };
}

async function submitAndWaitHidden(input: ReturnType<Page['locator']>, page: Page): Promise<void> {
  const signInBtn = page.locator('#idSIButton9, input[type="submit"], button[type="submit"]').first();
  if (await signInBtn.isVisible().catch(() => false)) await signInBtn.click();
  else await input.press('Enter');
  await input.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
}

function showMfaNumber(ctx: LoopContext, number: string): void {
  if (ctx.shownMfa.has(number)) return;
  ctx.shownMfa.add(number);
  const highlighted = chalk.inverse(` ${number} `);
  const line = '  MFA  Tap this number in your Authenticator app: ' + highlighted + '  ';
  console.log('');
  console.log(chalk.bold.bgYellow.black(line));
  console.log(chalk.gray('  (waiting for your approval…)'));
  console.log('');
}

function showMfaApprove(ctx: LoopContext): void {
  if (ctx.shownMfa.has('approve')) return;
  ctx.shownMfa.add('approve');
  console.log('');
  console.log(chalk.bold.bgYellow.black('  MFA  Open Microsoft Authenticator and tap APPROVE  '));
  console.log(chalk.gray('  (waiting for your approval on the phone…)'));
  console.log('');
}

async function handleSamlDomain(ctx: LoopContext): Promise<void> {
  if (ctx.flags.samlSubmitted) return;
  ctx.logger.step('Submitting SAML domain…');
  await ctx.page.locator('#outlined-size-normal, input[type="text"]').first().fill(ctx.config.gofluentDomain);
  await ctx.page.locator('button[type="submit"], input[type="submit"]').first().click();
  ctx.flags.samlSubmitted = true;
}

async function handleUsername(ctx: LoopContext): Promise<void> {
  if (ctx.flags.emailEntered) return;
  ctx.logger.step('Entering email…');
  const user = ctx.page.locator('#i0116, input[type="email"]').first();
  await user.fill(ctx.config.gofluentUsername);
  await submitAndWaitHidden(user, ctx.page);
  ctx.flags.emailEntered = true;
}

async function handlePassword(ctx: LoopContext): Promise<void> {
  if (ctx.flags.credsEntered) return;
  ctx.logger.step('Entering password…');
  const pwd = ctx.page.locator('#i0118').first();
  await pwd.fill(ctx.config.gofluentPassword);
  await submitAndWaitHidden(pwd, ctx.page);
  ctx.flags.credsEntered = true;
}

async function handleMfaMethodPicker(ctx: LoopContext): Promise<void> {
  ctx.logger.step('Selecting Authenticator push…');
  await ctx.page.getByText(/Approve a request on.*Authenticator/i).first().click().catch(() => {});
  await ctx.page.waitForTimeout(1500);
  showMfaApprove(ctx);
}

async function handleStaySignedIn(ctx: LoopContext): Promise<void> {
  ctx.logger.step('Accepting "Stay signed in"…');
  await ctx.page.locator('#idSIButton9, #acceptButton').first().click().catch(() => {});
}

async function runState(ctx: LoopContext, state: DetectedState): Promise<void> {
  switch (state.kind) {
    case 'saml-domain': await handleSamlDomain(ctx); return;
    case 'ms-username': await handleUsername(ctx); return;
    case 'ms-password': await handlePassword(ctx); return;
    case 'ms-mfa-number': showMfaNumber(ctx, state.number ?? ''); return;
    case 'ms-mfa-method-picker': await handleMfaMethodPicker(ctx); return;
    case 'ms-mfa-approve-waiting': showMfaApprove(ctx); return;
    case 'ms-stay-signed-in': await handleStaySignedIn(ctx); return;
    case 'ms-cred-error':
      throw new Error('Invalid GoFluent credentials. Check GOFLUENT_USERNAME / GOFLUENT_PASSWORD in .env');
  }
}

async function runLoginLoop(ctx: LoopContext, base: string, isTokenReady: () => boolean): Promise<void> {
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline && !isTokenReady()) {
    const state = await detectState(ctx.page, base);
    const stateSuffix = state.number ? ` (${state.number})` : '';
    ctx.logger.debug(`state=${state.kind}${stateSuffix}`);

    if (state.kind === 'dashboard') return;
    await runState(ctx, state);

    await ctx.page.waitForTimeout(state.kind === 'loading' ? 1500 : 800);
  }
}

// ── Token capture ──────────────────────────────────────────────────────────

interface TokenCapture {
  getToken(): string;
  getUserId(): string;
  ready: Promise<void>;
  attach(page: Page, logger: Logger): void;
}

function makeTokenCapture(): TokenCapture {
  let token = '';
  let userId = '';
  let resolver: () => void = () => {};
  const ready = new Promise<void>(r => { resolver = r; });

  return {
    getToken: () => token,
    getUserId: () => userId,
    ready,
    attach(page, logger) {
      page.on('request', (req) => {
        if (token) return;
        const auth = req.headers()['authorization'];
        if (!auth?.startsWith('Bearer ')) return;
        token = auth;
        const payload = decodeJwt(auth);
        userId = payload.sub || payload.uuid || payload.userId || '';
        logger.debug(`Bearer captured on ${req.method()} ${req.url().slice(0, 80)}`);
        resolver();
      });
    },
  };
}

function waitWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function fetchUserIdFromProfile(token: string, base: string, logger: Logger): Promise<string> {
  logger.debug('Fetching userId via /learner-preferences/user-profile/');
  const resp = await fetch(`${base}/api/v1/learner-preferences/user-profile/`, {
    headers: { Authorization: token }, redirect: 'follow',
  });
  if (!resp.ok) return '';
  try {
    const body = await resp.clone().json().catch(() => null);
    const candidate = body?.uuid || body?.id || body?.userUuid;
    if (typeof candidate === 'string' && UUID_RE.test(candidate)) return candidate;
  } catch { /* ignore */ }
  const match = UUID_RE.exec(resp.url);
  return match ? match[0] : '';
}

// ── Entry point ────────────────────────────────────────────────────────────

export async function authenticate(
  config: AppConfig,
  _headless: boolean,
  logger: Logger,
): Promise<AuthResult> {
  const cached = loadTokenCache(logger);
  if (cached) {
    logger.success(`Session reused (user: ${cached.userId.slice(0, 8)})`);
    return { token: cached.token, userId: cached.userId };
  }

  const base = siteBase(config.gofluentDomain);
  const hasSession = existsSync(STORAGE_PATH);
  logger.step(hasSession ? 'Reconnecting with saved session…' : 'Opening headless browser for first login…');

  const browser = await launchBrowser(logger);
  const ctx: BrowserContext = await browser.newContext(hasSession ? { storageState: STORAGE_PATH } : {});
  const page = await ctx.newPage();
  const capture = makeTokenCapture();
  capture.attach(page, logger);

  try {
    const entryUrl = hasSession ? `${base}/app/dashboard` : 'https://portal.gofluent.com/login/samlconnector';
    await page.goto(entryUrl, { waitUntil: 'domcontentloaded' });

    const loop: LoopContext = {
      page, config, logger,
      shownMfa: new Set(),
      flags: { samlSubmitted: false, emailEntered: false, credsEntered: false },
    };
    await runLoginLoop(loop, base, () => !!capture.getToken());

    if (!capture.getToken()) {
      logger.debug(`Forcing dashboard load (current: ${page.url()})`);
      await page.goto(`${base}/app/dashboard`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    }

    await waitWithTimeout(capture.ready, TOKEN_CAPTURE_TIMEOUT_MS).catch((e) => logger.debug(`token wait: ${e}`));

    const token = capture.getToken();
    let userId = capture.getUserId();
    if (!userId && token) userId = await fetchUserIdFromProfile(token, base, logger);

    mkdirSync(dirname(STORAGE_PATH), { recursive: true });
    await ctx.storageState({ path: STORAGE_PATH });

    if (!token) throw new Error('Failed to extract Bearer token');
    if (!userId) throw new Error('Failed to extract user ID');

    saveTokenCache(token, userId);
    logger.success(`Signed in (user: ${userId.slice(0, 8)})`);
    return { token, userId };
  } finally {
    await browser.close();
  }
}
