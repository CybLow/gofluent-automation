import type { Page } from 'playwright';
import type { IAppConfig } from '@/config/IAppConfig';
import type { ILogger } from '@/infra/logging/ILogger';
import { LOGIN_TIMEOUT_MS } from '@/constants';
import { MfaDisplay } from '@/auth/MfaDisplay';
import type { AuthState, DetectedState, LoginStateDetector } from './LoginStateDetector';
import { MfaMethodPickerHandler } from './handlers/MfaMethodPickerHandler';
import { PasswordHandler } from './handlers/PasswordHandler';
import { SamlDomainHandler } from './handlers/SamlDomainHandler';
import { StaySignedInHandler } from './handlers/StaySignedInHandler';
import { UsernameHandler } from './handlers/UsernameHandler';
import type { ILoginStateHandler, LoginContext } from './handlers/ILoginStateHandler';

type HandlerMap = Partial<Record<AuthState, ILoginStateHandler>>;

export class LoginStateMachine {
  private readonly handlers: HandlerMap;
  private readonly mfa = new MfaDisplay();

  constructor(
    private readonly detector: LoginStateDetector,
    private readonly config: IAppConfig,
    private readonly logger: ILogger,
  ) {
    this.handlers = {
      'saml-domain': new SamlDomainHandler(),
      'ms-username': new UsernameHandler(),
      'ms-password': new PasswordHandler(),
      'ms-mfa-method-picker': new MfaMethodPickerHandler(),
      'ms-stay-signed-in': new StaySignedInHandler(),
    };
  }

  async run(page: Page, isTokenReady: () => boolean): Promise<void> {
    const ctx = this.buildContext(page);
    const deadline = Date.now() + LOGIN_TIMEOUT_MS;

    while (Date.now() < deadline && !isTokenReady()) {
      const state = await this.detector.detect(page);
      this.logger.debug(`state=${state.kind}${state.number ? ` (${state.number})` : ''}`);

      if (state.kind === 'dashboard') return;
      await this.dispatch(ctx, state);

      await page.waitForTimeout(state.kind === 'loading' ? 1500 : 800);
    }
  }

  private buildContext(page: Page): LoginContext {
    return {
      page,
      config: this.config,
      logger: this.logger,
      mfa: this.mfa,
      flags: { samlSubmitted: false, emailEntered: false, credsEntered: false },
    };
  }

  private async dispatch(ctx: LoginContext, state: DetectedState): Promise<void> {
    if (state.kind === 'ms-mfa-number') { this.mfa.showNumber(state.number ?? ''); return; }
    if (state.kind === 'ms-mfa-approve-waiting') { this.mfa.showApprove(); return; }
    if (state.kind === 'ms-cred-error') {
      throw new Error('Invalid GoFluent credentials. Check GOFLUENT_USERNAME / GOFLUENT_PASSWORD in .env');
    }
    const handler = this.handlers[state.kind];
    if (handler) await handler.handle(ctx, state.number);
  }
}
