import { selectors } from '@/auth/login/selectors';
import { submitAndWaitHidden, type ILoginStateHandler, type LoginContext } from './ILoginStateHandler';

export class PasswordHandler implements ILoginStateHandler {
  async handle(ctx: LoginContext): Promise<void> {
    if (ctx.flags.credsEntered) return;
    ctx.logger.step('Entering password…');
    const pwd = ctx.page.locator(selectors.msPasswordInput).first();
    await pwd.fill(ctx.config.gofluentPassword);
    await submitAndWaitHidden(pwd, ctx.page);
    ctx.flags.credsEntered = true;
  }
}
