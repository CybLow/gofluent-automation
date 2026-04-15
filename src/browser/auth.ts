import type { Page } from 'playwright';
import { SELECTORS } from '../constants/selectors.js';
import type { Urls } from '../constants/urls.js';
import type { AppConfig } from '../types.js';
import type { Logger } from '../utils/logger.js';
import type { BrowserSession } from './session.js';

const S = SELECTORS;

export class Authenticator {
  constructor(
    private readonly session: BrowserSession,
    private readonly config: AppConfig,
    private readonly siteUrls: Urls,
    private readonly logger: Logger,
  ) {}

  async login(): Promise<void> {
    const page = this.session.page;

    // Step 0: Check if stored session is still valid
    this.logger.info('Checking existing session...');
    await page.goto(this.siteUrls.DASHBOARD, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    if (this.isOnDashboard(page)) {
      this.logger.success('Session still valid, already logged in.');
      return;
    }

    // Step 1: Navigate to SAML connector
    this.logger.info('Navigating to SAML connector...');
    await page.goto(this.siteUrls.SAML_CONNECTOR, { waitUntil: 'domcontentloaded' });

    // Enter domain
    await page.locator(S.LOGIN.DOMAIN_INPUT).waitFor({ timeout: 20_000 });
    await page.locator(S.LOGIN.DOMAIN_INPUT).fill(this.config.gofluentDomain);
    await page.locator(S.LOGIN.SUBMIT_BUTTON).click();

    // Step 2: Wait for Microsoft redirect or direct dashboard
    this.logger.info('Waiting for Microsoft redirect...');
    await page.waitForURL(
      url => {
        const href = url.toString();
        return href.includes('login.microsoftonline.com') || this.isDashboardUrl(href);
      },
      { timeout: 30_000 },
    );

    if (this.isOnDashboard(page)) {
      this.logger.success('SSO cached, direct redirect to dashboard.');
      await this.session.saveSession();
      return;
    }

    // Step 3: Microsoft login
    await this.handleMicrosoftLogin(page);

    // Step 4: Wait for dashboard
    await this.waitForDashboard(page);
    this.logger.success('Successfully logged in.');
    await this.session.saveSession();
  }

  private async handleMicrosoftLogin(page: Page): Promise<void> {
    // Handle "Pick an account" screen
    const otherAccount = page.locator(S.MICROSOFT.PICK_ACCOUNT_OTHER);
    try {
      await otherAccount.waitFor({ state: 'visible', timeout: 3_000 });
      await otherAccount.click();
      this.logger.debug('Clicked "Use another account"');
    } catch {
      // No account picker, continue
    }

    // Enter username
    this.logger.info('Entering credentials...');
    const usernameInput = page.locator(S.MICROSOFT.USERNAME_INPUT);
    await usernameInput.waitFor({ state: 'visible', timeout: 15_000 });
    await usernameInput.fill('');
    await usernameInput.fill(this.config.gofluentUsername);
    await page.locator(S.MICROSOFT.SUBMIT_BUTTON).click();

    // Enter password
    const passwordInput = page.locator(S.MICROSOFT.PASSWORD_INPUT);
    await passwordInput.waitFor({ state: 'visible', timeout: 15_000 });
    await passwordInput.fill(this.config.gofluentPassword);
    await page.locator(S.MICROSOFT.SUBMIT_BUTTON).click();

    // Check for invalid credentials
    const feedbackError = page.locator(S.MICROSOFT.FEEDBACK_ERROR);
    if (await feedbackError.isVisible({ timeout: 3_000 }).catch(() => false)) {
      throw new Error('Invalid GoFluent credentials. Check GOFLUENT_USERNAME and GOFLUENT_PASSWORD in .env');
    }

    // Handle MFA + "Stay signed in?" prompt
    this.logger.info('Waiting for MFA / redirect...');
    await this.waitForMfaOrStaySignedIn(page);
  }

  private async waitForMfaOrStaySignedIn(page: Page): Promise<void> {
    // Wait for EITHER: dashboard redirect OR "Stay signed in?" prompt
    // Allow up to 120 seconds for MFA
    const dashboardPromise = page.waitForURL(
      url => this.isDashboardUrl(url.toString()),
      { timeout: 120_000 },
    ).catch(() => null);

    const staySignedInPromise = Promise.race([
      page.locator(S.MICROSOFT.STAY_SIGNED_IN).waitFor({ state: 'visible', timeout: 120_000 }),
      page.locator(S.MICROSOFT.STAY_SIGNED_IN_FR).waitFor({ state: 'visible', timeout: 120_000 }),
    ]).catch(() => null);

    await Promise.race([dashboardPromise, staySignedInPromise]);

    // If we landed on dashboard already, done
    if (this.isOnDashboard(page)) return;

    // Check if "Stay signed in?" is visible and click yes
    const staySignedInVisible =
      await page.locator(S.MICROSOFT.STAY_SIGNED_IN).isVisible().catch(() => false) ||
      await page.locator(S.MICROSOFT.STAY_SIGNED_IN_FR).isVisible().catch(() => false);

    if (staySignedInVisible) {
      this.logger.debug('Clicking "Stay signed in"');
      await page.locator(S.MICROSOFT.SUBMIT_BUTTON).click();
    }
  }

  private async waitForDashboard(page: Page): Promise<void> {
    this.logger.info('Waiting for dashboard to load...');

    await page.waitForURL(
      url => this.isDashboardUrl(url.toString()),
      { timeout: 60_000 },
    );

    // Wait for dashboard content to appear
    try {
      await page.locator(`${S.DASHBOARD.LOGO}, ${S.DASHBOARD.HEADER}`).first().waitFor({ timeout: 30_000 });
    } catch {
      // URL is correct, content may still be loading
      this.logger.debug('Dashboard header not found, but URL is correct');
    }
  }

  private isDashboardUrl(href: string): boolean {
    return href.includes('gofluent.com/app/')
      && !href.includes('samlconnector')
      && !href.includes('login');
  }

  private isOnDashboard(page: Page): boolean {
    return this.isDashboardUrl(page.url());
  }
}
