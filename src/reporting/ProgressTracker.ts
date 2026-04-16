import chalk from 'chalk';

export interface TickOutcome {
  kind: 'ok' | 'skipped' | 'failed' | 'error';
  score?: number | null;
  questionCount?: number;
  message?: string;
}

export class ProgressTracker {
  constructor(private readonly total: number) {}

  renderHeader(categories: string[], batchSize: number): string {
    return `Categories: ${categories.join(', ')}  |  batch size: ${batchSize}  |  goal: ${this.total}`;
  }

  printRowPrefix(attempt: number, solved: number, category: string, title: string, contentUuid: string): void {
    const progress = `${solved}/${this.total}`;
    const tag = chalk.gray(`[#${String(attempt).padStart(2)} ${progress.padEnd(5)} ${category.padEnd(10)}]`);
    const name = title ? chalk.white(title) : chalk.dim(contentUuid);
    process.stdout.write(`  ${tag} ${name.slice(0, 55).padEnd(55)} `);
  }

  printRowOutcome(outcome: TickOutcome): void {
    switch (outcome.kind) {
      case 'ok':
        console.log(chalk.green(`${outcome.score ?? '?'}%  (${outcome.questionCount}q)`));
        return;
      case 'skipped':
        console.log(chalk.yellow('skipped (no quiz)'));
        return;
      case 'failed':
        console.log(chalk.red(`failed (${outcome.score}%)`));
        return;
      case 'error':
        console.log(chalk.red(`error: ${outcome.message}`));
        return;
    }
  }
}
