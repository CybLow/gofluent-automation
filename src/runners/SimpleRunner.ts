import { BrowserSession } from '../browser/session.js';
import { Authenticator } from '../browser/auth.js';
import { urls } from '../constants/urls.js';
import { Activity } from '../core/Activity.js';
import { ActivitySolving } from '../core/ActivitySolving.js';
import { ensureLanguage } from '../navigation/profile.js';
import { dismissModals } from '../navigation/dashboard.js';
import { QuizInterceptor } from '../services/quiz-interceptor.js';
import type { AppConfig, CLIOptions } from '../types.js';
import type { Logger } from '../utils/logger.js';

export class SimpleRunner {
  constructor(
    private readonly options: CLIOptions,
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}

  async execute(): Promise<void> {
    const activityUrl = this.options.simpleRun;
    if (!activityUrl) throw new Error('No URL provided for simple-run mode');

    const siteUrls = urls(this.config.gofluentDomain);
    const session = new BrowserSession(this.options.headless, this.logger);
    const page = await session.launch();

    try {
      const auth = new Authenticator(session, this.config, siteUrls, this.logger);
      await auth.login();
      await dismissModals(page, this.logger);
      await ensureLanguage(page, this.options.language, siteUrls, this.logger);

      this.logger.info(`Solving activity: ${activityUrl}`);
      const activity = new Activity(activityUrl);
      const interceptor = new QuizInterceptor(this.logger);
      interceptor.startListening(page);

      await new ActivitySolving(this.logger, page, activity, interceptor).resolveQuiz();
      this.logger.success('Activity completed!');
    } finally {
      await session.close();
      this.logger.close();
    }
  }
}
