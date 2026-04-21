import chalk from 'chalk';

export interface TickOutcome {
  kind: 'ok' | 'skipped' | 'failed' | 'error';
  score?: number | null;
  questionCount?: number;
  message?: string;
}

export class ProgressTracker {
  constructor(
    private readonly total: number,
    private readonly debugEnabled = false,
  ) {}

  renderHeader(categories: string[], batchSize: number): string {
    return `Categories: ${categories.join(', ')}  |  batch size: ${batchSize}  |  goal: ${this.total}`;
  }

  printRowPrefix(attempt: number, solved: number, category: string, title: string, contentUuid: string): void {
    const progress = `${solved}/${this.total}`;
    const tag = chalk.gray(`[#${String(attempt).padStart(2)} ${progress.padEnd(5)} ${category.padEnd(10)}]`);
    const name = title ? chalk.white(title) : chalk.dim(contentUuid);
    const line = `  ${tag} ${name.slice(0, 55).padEnd(55)} `;
    if (this.debugEnabled) console.log(line);
    else process.stdout.write(line);
  }

  printRowOutcome(outcome: TickOutcome): void {
    const body = this.formatOutcome(outcome);
    if (this.debugEnabled) console.log(`    ${chalk.gray('→')} ${body}`);
    else console.log(body);
  }

  private formatOutcome(outcome: TickOutcome): string {
    switch (outcome.kind) {
      case 'ok':      return chalk.green(`${outcome.score ?? '?'}%  (${outcome.questionCount}q)`);
      case 'skipped': return chalk.yellow('skipped (no quiz)');
      case 'failed':  return chalk.red(`failed (${outcome.score}%)`);
      case 'error':   return chalk.red(`error: ${outcome.message}`);
    }
  }
}
