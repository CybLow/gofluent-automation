import type { Page } from 'playwright';
import type { ILogger } from '@/infra/logging/ILogger';
import { JwtDecoder } from './JwtDecoder';

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
      this.token = auth;
      this.userId = this.jwt.extractUserId(auth);
      this.logger.debug(`Bearer captured on ${req.method()} ${req.url().slice(0, 80)}`);
      this.resolveReady();
    });
  }

  getToken(): string { return this.token; }
  getUserId(): string { return this.userId; }
  isReady(): boolean { return this.token !== ''; }
}
