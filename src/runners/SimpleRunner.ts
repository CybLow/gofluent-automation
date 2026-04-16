import type { ApiClient } from '../api.js';
import type { Logger } from '../logger.js';
import type { CLIOptions } from '../types.js';
import { extractUuidFromUrl, solveQuiz } from '../services/quiz.js';

export class SimpleRunner {
  constructor(
    private readonly options: CLIOptions,
    private readonly api: ApiClient,
    private readonly topicUuid: string,
    private readonly logger: Logger,
  ) {}

  async execute(): Promise<void> {
    const input = this.options.simpleRun;
    if (!input) throw new Error('No URL/UUID provided for simple-run mode');

    const contentUuid = extractUuidFromUrl(input) ?? input;
    if (!/^[0-9a-f-]{36}$/i.test(contentUuid)) {
      throw new Error(`Could not extract a content UUID from: ${input}`);
    }

    this.logger.info(`Solving activity: ${contentUuid}`);
    const result = await solveQuiz(this.api, contentUuid, this.topicUuid, this.logger);
    if (result.skipped) this.logger.warn('Activity skipped (no quiz)');
    else this.logger.success(`Activity completed! (score: ${result.score ?? 'n/a'}%)`);
  }
}
