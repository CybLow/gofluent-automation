import chalk from 'chalk';
import { BATCH_SIZE, MIN_VALID_SCORE, UUID_REGEX } from '@/constants';
import type { ILogger } from '@/infra/logging/ILogger';
import type { IUrlCacheRepo } from '@/infra/persistence/IUrlCacheRepo';
import { ProgressTracker } from '@/reporting/ProgressTracker';
import type { DiscoverOptions, IActivityDiscovery } from '@/services/activities/IActivityDiscovery';
import type { IQuizSolver } from '@/services/quiz/IQuizSolver';
import type { ITrainingReportService } from '@/services/training/ITrainingReportService';
import { ALL_CATEGORIES, type ActivityCategory } from '@/types/activity';
import type { DiscoveredActivity } from '@/types/report';
import type { AutoOptions } from '@/types/options';
import type { IRunner } from './IRunner';

interface SolveLoopState {
  solved: number;
  attempted: number;
  categoryIndex: number;
  exhausted: Set<ActivityCategory>;
}

export class AutoRunner implements IRunner {
  constructor(
    private readonly training: ITrainingReportService,
    private readonly discovery: IActivityDiscovery,
    private readonly quiz: IQuizSolver,
    private readonly urlCache: IUrlCacheRepo,
    private readonly siteBase: string,
    private readonly logger: ILogger,
    private readonly options: AutoOptions,
  ) {}

  async execute(): Promise<void> {
    const report = await this.training.fetch();
    const doneUuids = new Set(report.all.map(a => a.contentUuid));

    if (this.options.cache) this.urlCache.add(report.monthly.map(a => a.url));

    const todoCount = this.computeTodoCount(report.monthlyValid.length);
    if (todoCount === 0) return;

    const excluded = this.buildExclusionSet(doneUuids);
    await this.runSolveLoop(excluded, todoCount);
  }

  private computeTodoCount(monthlyValid: number): number {
    const target = this.options.autoRun;
    if (this.options.debug) {
      this.logger.info(`Forcing ${target} new activities (debug mode, ${monthlyValid} already done this month)`);
      return target;
    }
    const todo = Math.max(0, target - monthlyValid);
    if (todo === 0) this.logger.success(`Monthly target already met (${monthlyValid}/${target})`);
    else this.logger.step(`Need ${todo} more activities (${monthlyValid}/${target} done this month)`);
    return todo;
  }

  private buildExclusionSet(doneUuids: Set<string>): Set<string> {
    const excluded = new Set<string>(doneUuids);
    if (!this.options.cache) return excluded;
    for (const url of this.urlCache.getAll()) {
      const m = UUID_REGEX.exec(url);
      if (m) excluded.add(m[0].toLowerCase());
    }
    return excluded;
  }

  private async runSolveLoop(excluded: Set<string>, todoCount: number): Promise<void> {
    const categories = this.selectCategories();
    const progress = new ProgressTracker(todoCount);
    this.logger.info(progress.renderHeader(categories, BATCH_SIZE));
    console.log('');

    const state: SolveLoopState = {
      solved: 0, attempted: 0, categoryIndex: 0, exhausted: new Set(),
    };
    const t0 = Date.now();

    while (state.solved < todoCount && state.exhausted.size < categories.length) {
      const category = categories[state.categoryIndex++ % categories.length];
      if (state.exhausted.has(category)) continue;

      const batch = await this.discoverBatch(category, excluded, todoCount - state.solved);
      if (batch.length === 0) { state.exhausted.add(category); continue; }

      await this.solveBatch(batch, category, excluded, todoCount, state, progress);
    }

    this.printSummary(state, todoCount, Date.now() - t0);
  }

  private async solveBatch(
    batch: DiscoveredActivity[],
    category: ActivityCategory,
    excluded: Set<string>,
    todoCount: number,
    state: SolveLoopState,
    progress: ProgressTracker,
  ): Promise<void> {
    for (const act of batch) {
      if (state.solved >= todoCount) break;
      state.attempted++;
      progress.printRowPrefix(state.attempted, state.solved, category, act.title, act.contentUuid);
      const succeeded = await this.solveOne(act.contentUuid, progress);
      if (succeeded) state.solved++;
      excluded.add(act.contentUuid);
    }
  }

  private async solveOne(contentUuid: string, progress: ProgressTracker): Promise<boolean> {
    const url = `${this.siteBase}/app/dashboard/learning/${contentUuid}`;
    try {
      const result = await this.quiz.solve(contentUuid);
      if (this.options.cache) this.urlCache.add([url]);

      if (result.skipped) { progress.printRowOutcome({ kind: 'skipped' }); return false; }
      if (result.score !== null && result.score < MIN_VALID_SCORE) {
        progress.printRowOutcome({ kind: 'failed', score: result.score });
        return false;
      }
      progress.printRowOutcome({ kind: 'ok', score: result.score, questionCount: result.questionCount });
      return true;
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e).replaceAll(/\s+/g, ' ').slice(0, 120);
      progress.printRowOutcome({ kind: 'error', message: msg });
      if (this.options.cache) this.urlCache.add([url]);
      return false;
    }
  }

  private async discoverBatch(
    category: ActivityCategory,
    excluded: Set<string>,
    remaining: number,
  ): Promise<DiscoveredActivity[]> {
    const opts: DiscoverOptions = {
      minimumLevel: this.options.minimumLevel,
      maximumLevel: this.options.maximumLevel,
    };
    const list = await this.discovery.discover(category, excluded, opts);
    return list.slice(0, Math.min(BATCH_SIZE, remaining));
  }

  private selectCategories(): ActivityCategory[] {
    const selected: ActivityCategory[] = [];
    if (this.options.vocabulary) selected.push('vocabulary');
    if (this.options.grammar) selected.push('grammar');
    if (this.options.article) selected.push('article');
    if (this.options.video) selected.push('video');
    if (this.options.howto) selected.push('howto');
    return selected.length > 0 ? selected : ALL_CATEGORIES;
  }

  private printSummary(state: SolveLoopState, todoCount: number, elapsedMs: number): void {
    console.log('');
    const elapsed = (elapsedMs / 1000).toFixed(1);
    const failed = state.attempted - state.solved;
    const suffix = failed > 0 ? ` (${failed} skipped/failed)` : '';
    if (state.solved === todoCount) {
      this.logger.success(chalk.bold(`Completed ${state.solved}/${todoCount} activities in ${elapsed}s${suffix}`));
    } else {
      this.logger.warn(`Stopped at ${state.solved}/${todoCount} after ${elapsed}s (no more fresh activities${suffix})`);
    }
  }
}
