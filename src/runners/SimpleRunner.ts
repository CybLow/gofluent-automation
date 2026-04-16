import type { ILogger } from '@/infra/logging/ILogger';
import type { IQuizSolver } from '@/services/quiz/IQuizSolver';
import { UuidExtractor } from '@/services/quiz/UuidExtractor';
import type { SimpleOptions } from '@/types/options';
import type { IRunner } from './IRunner';

export class SimpleRunner implements IRunner {
  constructor(
    private readonly quiz: IQuizSolver,
    private readonly logger: ILogger,
    private readonly options: SimpleOptions,
  ) {}

  async execute(): Promise<void> {
    const input = this.options.simpleRun;
    const contentUuid = UuidExtractor.extract(input) ?? input;
    if (!UuidExtractor.isUuid(contentUuid)) {
      throw new Error(`Could not extract a content UUID from: ${input}`);
    }

    this.logger.info(`Solving activity: ${contentUuid}`);
    const result = await this.quiz.solve(contentUuid);
    if (result.skipped) this.logger.warn('Activity skipped (no quiz)');
    else this.logger.success(`Activity completed! (score: ${result.score ?? 'n/a'}%)`);
  }
}
