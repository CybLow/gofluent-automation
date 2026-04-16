import { patterns } from '@/auth/login/selectors';
import type { ILoginStateHandler, LoginContext } from './ILoginStateHandler';

export class MfaMethodPickerHandler implements ILoginStateHandler {
  async handle(ctx: LoginContext): Promise<void> {
    ctx.logger.step('Selecting Authenticator push…');
    await ctx.page.getByText(patterns.approveAuthenticatorText).first().click().catch(() => {});
    await ctx.page.waitForTimeout(1500);
    ctx.mfa.showApprove();
  }
}
