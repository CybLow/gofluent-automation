import { selectors } from '@/auth/login/selectors';
import { submitAndWaitHidden, type ILoginStateHandler, type LoginContext } from './ILoginStateHandler';

export class UsernameHandler implements ILoginStateHandler {
  async handle(ctx: LoginContext): Promise<void> {
    if (ctx.flags.emailEntered) return;
    ctx.logger.step('Entering email…');
    const user = ctx.page.locator(selectors.msEmailInput).first();
    await user.fill(ctx.config.gofluentUsername);
    await submitAndWaitHidden(user, ctx.page);
    ctx.flags.emailEntered = true;
  }
}
