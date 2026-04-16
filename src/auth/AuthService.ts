import type { BrowserContext, Page } from 'playwright';
import type { IAppConfig } from '@/config/IAppConfig';
import type { IBrowserLauncher } from '@/infra/browser/IBrowserLauncher';
import type { ILogger } from '@/infra/logging/ILogger';
import type { ITokenCache } from '@/infra/persistence/ITokenCache';
import { TOKEN_CAPTURE_TIMEOUT_MS } from '@/constants';
import type { AuthResult } from '@/types/report';
import { JwtDecoder } from './JwtDecoder';
import { TokenCaptureService } from './TokenCaptureService';
import { UserProfileClient } from './UserProfileClient';
import { LoginStateDetector } from './login/LoginStateDetector';
import { LoginStateMachine } from './login/LoginStateMachine';
import type { IAuthService } from './IAuthService';

const SAML_ENTRY_URL = 'https://portal.gofluent.com/login/samlconnector';
const DEFAULT_TTL_SECONDS = 3600;

function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export class AuthService implements IAuthService {
  private readonly jwt = new JwtDecoder();

  constructor(
    private readonly config: IAppConfig,
    private readonly tokenCache: ITokenCache,
    private readonly browserLauncher: IBrowserLauncher,
    private readonly logger: ILogger,
  ) {}

  async authenticate(): Promise<AuthResult> {
    const cached = this.tokenCache.load();
    if (cached) {
      this.logger.success(`Session reused (user: ${cached.userId.slice(0, 8)})`);
      return { token: cached.token, userId: cached.userId };
    }
    return this.authenticateViaBrowser();
  }

  private async authenticateViaBrowser(): Promise<AuthResult> {
    const base = this.config.siteBase();
    const storageState = this.tokenCache.loadStorageState();
    const hasSession = storageState !== null;
    this.logger.step(hasSession ? 'Reconnecting with saved session…' : 'Opening headless browser for first login…');

    const browser = await this.browserLauncher.launch();
    try {
      const ctx = await browser.newContext(hasSession ? { storageState } : {});
      const page = await ctx.newPage();
      const capture = new TokenCaptureService(this.logger);
      capture.attach(page);

      await this.runLoginFlow(page, base, hasSession, capture);
      return await this.finalize(ctx, base, capture);
    } finally {
      await browser.close();
    }
  }

  private async runLoginFlow(
    page: Page,
    base: string,
    hasSession: boolean,
    capture: TokenCaptureService,
  ): Promise<void> {
    const entryUrl = hasSession ? `${base}/app/dashboard` : SAML_ENTRY_URL;
    await page.goto(entryUrl, { waitUntil: 'domcontentloaded' });

    const detector = new LoginStateDetector(base);
    const machine = new LoginStateMachine(detector, this.config, this.logger);
    await machine.run(page, () => capture.isReady());

    if (!capture.isReady()) {
      this.logger.debug(`Forcing dashboard load (current: ${page.url()})`);
      await page.goto(`${base}/app/dashboard`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    }
    await raceTimeout(capture.ready, TOKEN_CAPTURE_TIMEOUT_MS)
      .catch(e => this.logger.debug(`token wait: ${e}`));
  }

  private async finalize(
    ctx: BrowserContext,
    base: string,
    capture: TokenCaptureService,
  ): Promise<AuthResult> {
    const token = capture.getToken();
    if (!token) throw new Error('Failed to extract Bearer token');

    let userId = capture.getUserId();
    if (!userId) userId = await new UserProfileClient(base, this.logger).fetchUserId(token);
    if (!userId) throw new Error('Failed to extract user ID');

    const storageState = await ctx.storageState();
    const exp = this.jwt.extractExpiry(token, Math.floor(Date.now() / 1000) + DEFAULT_TTL_SECONDS);
    this.tokenCache.save({ token, userId, exp, storageState });
    this.logger.success(`Signed in (user: ${userId.slice(0, 8)})`);
    return { token, userId };
  }
}
