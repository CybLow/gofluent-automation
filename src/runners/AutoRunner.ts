import { BrowserSession } from '../browser/session.js';
import { Authenticator } from '../browser/auth.js';
import { urls, type ActivityCategory, type Urls } from '../constants/urls.js';
import { Activity } from '../core/Activity.js';
import { ActivityLearning } from '../core/ActivityLearning.js';
import { ActivitySolving } from '../core/ActivitySolving.js';
import { ensureLanguage } from '../navigation/profile.js';
import { dismissModals } from '../navigation/dashboard.js';
import { countMonthlyActivities } from '../navigation/training.js';
import { discoverActivities } from '../navigation/resources.js';
import { addToCache, getCachedUrls } from '../services/cache.js';
import { QuizInterceptor } from '../services/quiz-interceptor.js';
import type { AppConfig, CLIOptions } from '../types.js';
import type { Logger } from '../utils/logger.js';
import type { Page } from 'playwright';

const ALL_CATEGORIES: ActivityCategory[] = ['vocabulary', 'grammar', 'article', 'video', 'howto'];
const BATCH_SIZE = 3;

interface RunContext {
  page: Page;
  session: BrowserSession;
  siteUrls: Urls;
  cachedUrls: Set<string>;
  interceptor: QuizInterceptor;
}

export class AutoRunner {
  constructor(
    private readonly options: CLIOptions,
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}

  async execute(): Promise<void> {
    const siteUrls = urls(this.config.gofluentDomain);
    const session = new BrowserSession(this.options.headless, this.logger);
    const page = await session.launch();

    try {
      const auth = new Authenticator(session, this.config, siteUrls, this.logger);
      await auth.login();
      await dismissModals(page, this.logger);

      const { flagAlt } = await ensureLanguage(page, this.options.language, siteUrls, this.logger);
      const { count: monthlyCount, urls: doneUrls } = await countMonthlyActivities(page, siteUrls, flagAlt, this.logger);
      if (this.options.cache) addToCache(doneUrls);

      const todoCount = this.calculateTodoCount(monthlyCount);
      if (todoCount === 0) return;

      const cachedUrls = this.options.cache ? getCachedUrls() : new Set<string>();
      const interceptor = new QuizInterceptor(this.logger);
      const useApi = !this.options.noApi;
      if (useApi) interceptor.startListening(page);
      await this.solveActivities({ page, session, siteUrls, cachedUrls, interceptor }, todoCount);
    } finally {
      await session.close();
      this.logger.close();
    }
  }

  private calculateTodoCount(monthlyCount: number): number {
    const targetCount = this.options.autoRun ?? 13;

    if (this.options.debug) {
      this.logger.info(`[DEBUG] ${monthlyCount} done this month, forcing ${targetCount} new activities`);
      return targetCount;
    }

    const todo = Math.max(0, targetCount - monthlyCount);
    this.logger.info(`${monthlyCount}/${targetCount} done this month`);
    if (todo === 0) {
      this.logger.success(`Monthly target already met (${monthlyCount}/${targetCount})`);
    } else {
      this.logger.info(`${todo} more activities needed`);
    }
    return todo;
  }

  private async solveActivities(ctx: RunContext, todoCount: number): Promise<void> {
    const categories = this.getCategories();
    this.logger.info(`Categories: ${categories.join(', ')} (rotating every ${BATCH_SIZE})`);

    const solved = await this.runCategoryRotation(ctx, categories, todoCount);
    this.logger.success(`\nDone! Completed ${solved}/${todoCount} activities`);
  }

  private async runCategoryRotation(ctx: RunContext, categories: ActivityCategory[], todoCount: number): Promise<number> {
    let solved = 0;
    let categoryIndex = 0;
    const exhausted = new Set<string>();

    while (solved < todoCount && exhausted.size < categories.length) {
      const category = categories[categoryIndex++ % categories.length];
      if (exhausted.has(category)) continue;

      const batch = await this.discoverBatch(ctx, category, todoCount - solved);
      if (batch.length === 0) { exhausted.add(category); continue; }

      for (const actUrl of batch) {
        if (solved >= todoCount) break;
        if (await this.solveActivity(ctx, actUrl, category, solved, todoCount)) solved++;
      }
    }

    return solved;
  }

  private async discoverBatch(ctx: RunContext, category: ActivityCategory, remaining: number): Promise<string[]> {
    this.logger.info(`\nSearching ${category} (need ${remaining} more)...`);
    const urls = await discoverActivities(
      ctx.page, ctx.siteUrls, category, ctx.cachedUrls,
      { minimumLevel: this.options.minimumLevel, maximumLevel: this.options.maximumLevel },
      this.logger,
    );
    if (urls.length === 0) this.logger.warn(`No ${category} activities left, skipping`);
    return urls.slice(0, Math.min(BATCH_SIZE, remaining));
  }

  private async solveActivity(ctx: RunContext, actUrl: string, category: string, solved: number, todoCount: number): Promise<boolean> {
    this.logger.info(`\n${'='.repeat(60)}`);
    this.logger.info(`Activity ${solved + 1}/${todoCount} [${category}]: ${actUrl}`);
    this.logger.info('='.repeat(60));

    try {
      const activity = new Activity(actUrl);
      await new ActivityLearning(this.logger, ctx.page, activity).retrieveActivityData();
      const count = await new ActivitySolving(this.logger, ctx.page, activity, this.config, ctx.interceptor, !this.options.noApi).resolveQuiz();
      if (count > 0) this.logger.success(`Progress: ${solved + 1}/${todoCount}`);
      this.cacheUrl(ctx, actUrl);
      return count > 0;
    } catch (e) {
      await this.handleError(e, ctx, actUrl);
      return false;
    }
  }

  private async handleError(e: unknown, ctx: RunContext, actUrl: string): Promise<void> {
    const msg = String(e);
    if (msg.includes('SESSION_EXPIRED')) {
      this.logger.warn('Session expired, re-authenticating...');
      await new Authenticator(ctx.session, this.config, ctx.siteUrls, this.logger).login();
    } else if (msg.includes('NO_QUIZ_TAB')) {
      this.logger.warn('No quiz tab, skipping');
    } else {
      this.logger.error(`Activity failed: ${e}`);
    }
    this.cacheUrl(ctx, actUrl);
  }

  private cacheUrl(ctx: RunContext, url: string): void {
    if (this.options.cache) addToCache([url]);
    ctx.cachedUrls.add(url);
  }

  private getCategories(): ActivityCategory[] {
    if (this.options.vocabulary && !this.options.grammar) return ['vocabulary'];
    if (this.options.grammar && !this.options.vocabulary) return ['grammar'];
    if (this.options.vocabulary && this.options.grammar) return ['vocabulary', 'grammar'];
    return ALL_CATEGORIES;
  }
}
