import chalk from 'chalk';
import { MIN_VALID_SCORE, MONTHLY_TARGET_DEFAULT } from '@/constants';
import type { ActivityInfo } from '@/types/activity';
import type { TrainingReport } from '@/types/report';

const DIVIDER = '═══════════════════════════════════════════';

function fmtDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function avgScore(activities: ActivityInfo[]): number {
  const withScore = activities.filter(a => a.score !== null);
  if (withScore.length === 0) return 0;
  return withScore.reduce((sum, a) => sum + (a.score ?? 0), 0) / withScore.length;
}

export class ReportFormatter {
  format(report: TrainingReport): string[] {
    if (report.all.length === 0) return [chalk.yellow('No activities found.')];
    const lines: string[] = [];
    lines.push(...this.header());
    lines.push(...this.overallSection(report));
    lines.push(...this.monthlySection(report));
    lines.push(...this.distributionSection(report.monthlyValid));
    if (report.monthlyFailed.length > 0) lines.push(...this.failedSection(report.monthlyFailed));
    lines.push(...this.validSection(report.monthlyValid));
    return lines;
  }

  private header(): string[] {
    return ['', chalk.bold(DIVIDER), chalk.bold('         GoFluent Training Report'), chalk.bold(DIVIDER)];
  }

  private overallSection(report: TrainingReport): string[] {
    const dates = report.all.map(a => a.date.getTime());
    const oldest = new Date(Math.min(...dates));
    const newest = new Date(Math.max(...dates));
    return [
      '',
      chalk.bold('Period:       ') + `${fmtDate(oldest)} → ${fmtDate(newest)}`,
      chalk.bold('Total:        ') + `${report.all.length} attempts`,
      chalk.bold('Avg score:    ') + `${avgScore(report.all).toFixed(0)}%`,
    ];
  }

  private monthlySection(report: TrainingReport): string[] {
    const now = new Date();
    const label = `${now.toLocaleString('en', { month: 'long' })} ${now.getFullYear()}`;
    return [
      '',
      chalk.bold(`This month (${label}):`),
      chalk.bold('  Attempts:   ') + `${report.monthly.length}`,
      chalk.bold(`  Valid ≥${MIN_VALID_SCORE}%: `) + chalk.green(`${report.monthlyValid.length}`),
      chalk.bold(`  Failed <${MIN_VALID_SCORE}%: `)
        + (report.monthlyFailed.length > 0 ? chalk.red(`${report.monthlyFailed.length}`) : '0'),
      chalk.bold('  Target:     ') + `${report.monthlyValid.length}/${MONTHLY_TARGET_DEFAULT}`,
    ];
  }

  private distributionSection(valid: ActivityInfo[]): string[] {
    const perfect = valid.filter(a => a.score === 100).length;
    const good = valid.filter(a => (a.score ?? 0) >= MIN_VALID_SCORE && (a.score ?? 0) < 100).length;
    return [
      '',
      chalk.bold('Score distribution (valid):'),
      chalk.green(`  100%:    ${perfect}`),
      chalk.blue(`  ${MIN_VALID_SCORE}-99%:  ${good}`),
    ];
  }

  private failedSection(failed: ActivityInfo[]): string[] {
    const lines = ['', chalk.bold(chalk.red(`Need improvement (<${MIN_VALID_SCORE}%):`))];
    for (const a of failed.slice(0, 10)) {
      lines.push(chalk.red(`  ${String(a.score).padStart(3)}%`)
        + `  ${a.title.slice(0, 45).padEnd(45)}  ${chalk.gray(fmtDate(a.date))}`);
    }
    if (failed.length > 10) lines.push(chalk.gray(`  ... and ${failed.length - 10} more`));
    return lines;
  }

  private validSection(valid: ActivityInfo[]): string[] {
    const lines = ['', chalk.bold('Recent valid activities:')];
    for (const a of valid.slice(0, 15)) {
      const color = a.score === 100 ? chalk.green : chalk.blue;
      lines.push(`  ${color(`${a.score}%`).padEnd(15)} ${a.title.slice(0, 45).padEnd(45)}  ${chalk.gray(fmtDate(a.date))}`);
    }
    if (valid.length > 15) lines.push(chalk.gray(`  ... and ${valid.length - 15} more`));
    lines.push('');
    return lines;
  }
}
