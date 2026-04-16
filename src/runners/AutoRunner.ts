import chalk from 'chalk';
import type { ApiClient } from '../api.js';
import type { Logger } from '../logger.js';
import type { CLIOptions, ActivityCategory } from '../types.js';
import { ALL_CATEGORIES } from '../types.js';
import { discoverActivities } from '../services/discovery.js';
import { fetchTrainingReport } from '../services/training.js';
import { solveQuiz } from '../services/quiz.js';
import { addToCache, getCachedUrls } from '../cache.js';

const BATCH_SIZE = 3;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export class AutoRunner {
  constructor(
    private readonly options: CLIOptions,
    private readonly api: ApiClient,
    private readonly userId: string,
    private readonly topicUuid: string,
    private readonly logger: Logger,
  ) {}

  async execute(): Promise<void> {
    const report = await fetchTrainingReport(this.api, this.userId, this.topicUuid, this.logger);

    const doneUuids = new Set(report.all.map(a => a.contentUuid));
    if (this.options.cache) addToCache(report.monthly.map(a => a.url));

    const todoCount = this.calculateTodoCount(report.monthlyValid.length);
    if (todoCount === 0) return;

    const excluded = new Set<string>(doneUuids);
    if (this.options.cache) {
      for (const url of getCachedUrls()) {
        const m = UUID_RE.exec(url);
        if (m) excluded.add(m[0].toLowerCase());
      }
    }

    await this.solveActivities(excluded, todoCount);
  }

  private calculateTodoCount(monthlyValidCount: number): number {
    const target = this.options.autoRun ?? 13;
    if (this.options.debug) {
      this.logger.info(`Forcing ${target} new activities (debug mode, ${monthlyValidCount} already done this month)`);
      return target;
    }
    const todo = Math.max(0, target - monthlyValidCount);
    if (todo === 0) {
      this.logger.success(`Monthly target already met (${monthlyValidCount}/${target})`);
    } else {
      this.logger.step(`Need ${todo} more activities (${monthlyValidCount}/${target} done this month)`);
    }
    return todo;
  }

  private async solveActivities(excluded: Set<string>, todoCount: number): Promise<void> {
    const categories = this.getCategories();
    this.logger.info(`Categories: ${categories.join(', ')}  |  batch size: ${BATCH_SIZE}  |  goal: ${todoCount}`);
    console.log('');

    let solved = 0;
    let attempted = 0;
    let categoryIndex = 0;
    const exhausted = new Set<ActivityCategory>();
    const t0 = Date.now();

    while (solved < todoCount && exhausted.size < categories.length) {
      const category = categories[categoryIndex++ % categories.length];
      if (exhausted.has(category)) continue;

      const batch = await this.discoverBatch(category, excluded, todoCount - solved);
      if (batch.length === 0) { exhausted.add(category); continue; }

      for (const act of batch) {
        if (solved >= todoCount) break;
        attempted++;
        if (await this.solveOne(act.contentUuid, category, attempted, solved, todoCount, act.title)) solved++;
        excluded.add(act.contentUuid);
      }
    }

    console.log('');
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const failed = attempted - solved;
    const suffix = failed > 0 ? ` (${failed} skipped/failed)` : '';
    if (solved === todoCount) {
      this.logger.success(chalk.bold(`Completed ${solved}/${todoCount} activities in ${elapsed}s${suffix}`));
    } else {
      this.logger.warn(`Stopped at ${solved}/${todoCount} after ${elapsed}s (no more fresh activities${suffix})`);
    }
  }

  private async discoverBatch(category: ActivityCategory, excluded: Set<string>, remaining: number) {
    const urls = await discoverActivities(
      this.api, category, this.topicUuid, excluded,
      { minimumLevel: this.options.minimumLevel, maximumLevel: this.options.maximumLevel },
      this.logger,
    );
    return urls.slice(0, Math.min(BATCH_SIZE, remaining));
  }

  private async solveOne(
    contentUuid: string, category: string,
    attempt: number, solved: number, todoCount: number, title: string,
  ): Promise<boolean> {
    const progress = `${solved}/${todoCount}`;
    const tag = chalk.gray(`[#${String(attempt).padStart(2)} ${progress.padEnd(5)} ${category.padEnd(10)}]`);
    const name = title ? chalk.white(title) : chalk.dim(contentUuid);
    process.stdout.write(`  ${tag} ${name.slice(0, 55).padEnd(55)} `);

    const url = `${this.api.base}/app/dashboard/learning/${contentUuid}`;
    try {
      const result = await solveQuiz(this.api, contentUuid, this.topicUuid, this.logger);
      if (this.options.cache) addToCache([url]);

      if (result.skipped) {
        console.log(chalk.yellow('skipped (no quiz)'));
        return false;
      }
      if (result.score !== null && result.score < 80) {
        console.log(chalk.red(`failed (${result.score}%)`));
        return false;
      }
      console.log(chalk.green(`${result.score ?? '?'}%  (${result.questionCount}q)`));
      return true;
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e).replace(/\s+/g, ' ').slice(0, 120);
      console.log(chalk.red(`error: ${msg}`));
      if (this.options.cache) addToCache([url]);
      return false;
    }
  }

  private getCategories(): ActivityCategory[] {
    const selected: ActivityCategory[] = [];
    if (this.options.vocabulary) selected.push('vocabulary');
    if (this.options.grammar) selected.push('grammar');
    if (this.options.article) selected.push('article');
    if (this.options.video) selected.push('video');
    if (this.options.howto) selected.push('howto');
    return selected.length > 0 ? selected : ALL_CATEGORIES;
  }
}
