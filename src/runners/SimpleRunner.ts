import { BrowserSession } from '../browser/session.js';
import { Authenticator } from '../browser/auth.js';
import { urls } from '../constants/urls.js';
import { Activity } from '../core/Activity.js';
import { ActivityLearning } from '../core/ActivityLearning.js';
import { ActivitySolving } from '../core/ActivitySolving.js';
import { ensureLanguage } from '../navigation/profile.js';
import { dismissModals } from '../navigation/dashboard.js';
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
    if (!activityUrl) {
      throw new Error('No URL provided for simple-run mode');
    }

    const siteUrls = urls(this.config.gofluentDomain);
    const session = new BrowserSession(this.options.headless, this.logger);
    const page = await session.launch();

    try {
      // 1. Authenticate
      const auth = new Authenticator(session, this.config, siteUrls, this.logger);
      await auth.login();

      // Dismiss modals
      await dismissModals(page, this.logger);

      // 2. Set language
      await ensureLanguage(page, this.options.language, siteUrls, this.logger);

      // 3. Solve single activity
      this.logger.info(`Solving activity: ${activityUrl}`);
      const activity = new Activity(activityUrl);

      const learning = new ActivityLearning(this.logger, page, activity);
      await learning.retrieveActivityData();

      const solving = new ActivitySolving(this.logger, page, activity, this.config);
      await solving.resolveQuiz();

      this.logger.success('Activity completed!');
    } finally {
      await session.close();
      this.logger.close();
    }
  }
}
