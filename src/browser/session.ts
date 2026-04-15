import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Logger } from '../utils/logger.js';

const STORAGE_STATE_PATH = 'data/auth/storage-state.json';

export class BrowserSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private _page: Page | null = null;

  constructor(
    private readonly headless: boolean,
    private readonly logger: Logger,
  ) {}

  async launch(): Promise<Page> {
    this.browser = await chromium.launch({
      headless: this.headless,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    const hasStoredState = existsSync(STORAGE_STATE_PATH);
    if (hasStoredState) {
      this.logger.debug('Loading stored session state');
    }

    this.context = await this.browser.newContext(
      hasStoredState ? { storageState: STORAGE_STATE_PATH } : {},
    );

    this._page = await this.context.newPage();
    return this._page;
  }

  async saveSession(): Promise<void> {
    if (!this.context) return;
    mkdirSync(dirname(STORAGE_STATE_PATH), { recursive: true });
    await this.context.storageState({ path: STORAGE_STATE_PATH });
    this.logger.debug('Session state saved');
  }

  async close(): Promise<void> {
    try {
      await this.saveSession();
    } catch {
      // Ignore errors during cleanup
    }
    await this.browser?.close();
    this.browser = null;
    this.context = null;
    this._page = null;
  }

  get page(): Page {
    if (!this._page) throw new Error('Browser not launched. Call launch() first.');
    return this._page;
  }
}
