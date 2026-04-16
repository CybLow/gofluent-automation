import { selectors } from '@/auth/login/selectors';
import type { ILoginStateHandler, LoginContext } from './ILoginStateHandler';

export class SamlDomainHandler implements ILoginStateHandler {
  async handle(ctx: LoginContext): Promise<void> {
    if (ctx.flags.samlSubmitted) return;
    ctx.logger.step('Submitting SAML domain…');
    await ctx.page.locator(selectors.samlDomainInput).first().fill(ctx.config.gofluentDomain);
    await ctx.page.locator(selectors.samlSubmit).first().click();
    ctx.flags.samlSubmitted = true;
  }
}
