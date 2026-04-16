import type { Page } from 'playwright';
import { patterns, selectors } from './selectors';

export type AuthState =
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

export interface DetectedState { kind: AuthState; number?: string }

function isDashboardUrl(url: string, base: string): boolean {
  if (!url.includes(`${base}/app/`)) return false;
  return patterns.dashboardPath.test(url);
}

async function isVisibleAndEnabled(page: Page, selector: string): Promise<boolean> {
  const el = page.locator(selector).first();
  return (await el.isVisible().catch(() => false))
    && (await el.isEnabled().catch(() => false));
}

async function detectMfaNumber(page: Page): Promise<string | null> {
  const text = await page.locator(selectors.msMfaDisplaySign)
    .first().textContent({ timeout: 300 }).catch(() => null);
  if (!text) return null;
  const digits = text.replaceAll(/\D/g, '').trim();
  return digits.length >= 2 && digits.length <= 3 ? digits : null;
}

async function detectMfaPage(page: Page): Promise<AuthState | null> {
  if (!await page.locator(selectors.msMfaTitle).isVisible().catch(() => false)) return null;
  if (await page.getByText(patterns.approveAuthenticatorText).first().isVisible().catch(() => false)) {
    return 'ms-mfa-method-picker';
  }
  if (await page.getByText(patterns.waitingAuthenticatorText).first().isVisible().catch(() => false)) {
    return 'ms-mfa-approve-waiting';
  }
  return null;
}

export class LoginStateDetector {
  constructor(private readonly siteBase: string) {}

  async detect(page: Page): Promise<DetectedState> {
    const url = page.url();
    if (isDashboardUrl(url, this.siteBase)) return { kind: 'dashboard' };

    if (patterns.samlConnectorUrl.test(url)
      && await isVisibleAndEnabled(page, selectors.samlDomainInput)) {
      return { kind: 'saml-domain' };
    }

    if (await page.getByText(patterns.credErrorText).first().isVisible().catch(() => false)) {
      return { kind: 'ms-cred-error' };
    }

    if (await page.locator(selectors.msStaySignedIn).first().isVisible().catch(() => false)) {
      return { kind: 'ms-stay-signed-in' };
    }

    const mfaNum = await detectMfaNumber(page);
    if (mfaNum) return { kind: 'ms-mfa-number', number: mfaNum };

    const mfaState = await detectMfaPage(page);
    if (mfaState) return { kind: mfaState };

    if (await isVisibleAndEnabled(page, selectors.msEmailInput)) return { kind: 'ms-username' };
    if (await isVisibleAndEnabled(page, selectors.msPasswordInput)) return { kind: 'ms-password' };

    return { kind: 'loading' };
  }
}
