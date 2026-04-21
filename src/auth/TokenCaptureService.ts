import type { Page } from 'playwright';
import type { ILogger } from '@/infra/logging/ILogger';
import { JwtDecoder } from './JwtDecoder';

const FRESHNESS_MARGIN_SECONDS = 60;

export class TokenCaptureService {
  private token = '';
  private userId = '';
  private resolveReady: () => void = () => {};
  readonly ready: Promise<void>;

  constructor(
    private readonly logger: ILogger,
    private readonly jwt: JwtDecoder = new JwtDecoder(),
  ) {
    this.ready = new Promise(r => { this.resolveReady = r; });
  }

  attach(page: Page): void {
    page.on('request', (req) => {
      if (this.token) return;
      const auth = req.headers()['authorization'];
      if (!auth?.startsWith('Bearer ')) return;

      const exp = this.jwt.extractExpiry(auth, 0);
      const now = Math.floor(Date.now() / 1000);
      if (exp > 0 && exp <= now + FRESHNESS_MARGIN_SECONDS) {
        this.logger.debug(
          `Skipping stale Bearer on ${req.method()} ${req.url().slice(0, 80)} `
          + `(exp=${exp}, now=${now}, diff=${exp - now}s)`,
        );
        return;
      }

      this.token = auth;
      this.userId = this.jwt.extractUserId(auth);
      const remaining = exp > 0 ? `valid ${Math.floor((exp - now) / 60)}min` : 'no exp claim';
      this.logger.debug(`Bearer captured on ${req.method()} ${req.url().slice(0, 80)} (${remaining})`);
      this.resolveReady();
    });
  }

  getToken(): string { return this.token; }
  getUserId(): string { return this.userId; }
  isReady(): boolean { return this.token !== ''; }
}
