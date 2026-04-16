import { selectors } from '@/auth/login/selectors';
import type { ILoginStateHandler, LoginContext } from './ILoginStateHandler';

export class StaySignedInHandler implements ILoginStateHandler {
  async handle(ctx: LoginContext): Promise<void> {
    ctx.logger.step('Accepting "Stay signed in"…');
    await ctx.page.locator(selectors.msStaySignedInAccept).first().click().catch(() => {});
  }
}
