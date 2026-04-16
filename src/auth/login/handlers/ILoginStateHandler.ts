import type { Page, Locator } from 'playwright';
import type { IAppConfig } from '@/config/IAppConfig';
import type { ILogger } from '@/infra/logging/ILogger';
import type { MfaDisplay } from '@/auth/MfaDisplay';
import { selectors } from '@/auth/login/selectors';

export interface LoginContext {
  page: Page;
  config: IAppConfig;
  logger: ILogger;
  mfa: MfaDisplay;
  flags: { samlSubmitted: boolean; emailEntered: boolean; credsEntered: boolean };
}

export interface ILoginStateHandler {
  handle(ctx: LoginContext, stateNumber?: string): Promise<void>;
}

export async function submitAndWaitHidden(input: Locator, page: Page): Promise<void> {
  const signInBtn = page.locator(selectors.msSignInBtn).first();
  if (await signInBtn.isVisible().catch(() => false)) await signInBtn.click();
  else await input.press('Enter');
  await input.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
}
