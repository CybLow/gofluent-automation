import { BrowserSession } from '../browser/session.js';
import { Authenticator } from '../browser/auth.js';
import { urls } from '../constants/urls.js';
import { scanTrainingPage, type ActivityInfo } from '../navigation/training.js';
import { ensureLanguage } from '../navigation/profile.js';
import type { AppConfig, CLIOptions } from '../types.js';
import type { Logger } from '../utils/logger.js';
import chalk from 'chalk';

export class ReportRunner {
  constructor(
    private readonly options: CLIOptions,
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}

  async execute(): Promise<void> {
    const siteUrls = urls(this.config.gofluentDomain);
    const session = new BrowserSession(true, this.logger);
    const page = await session.launch();

    try {
      const auth = new Authenticator(session, this.config, siteUrls, this.logger);
      await auth.login();

      const { flagAlt } = await ensureLanguage(page, this.options.language, siteUrls, this.logger);
      const report = await scanTrainingPage(page, siteUrls, flagAlt, this.logger);
      this.printReport(report.all, report.monthlyValid, report.monthlyFailed);
    } finally {
      await session.close();
      this.logger.close();
    }
  }

  private printReport(all: ActivityInfo[], valid: ActivityInfo[], failed: ActivityInfo[]): void {
    if (all.length === 0) {
      console.log(chalk.yellow('No activities found.'));
      return;
    }

    const now = new Date();
    const monthly = all.filter(a => a.date.getMonth() === now.getMonth() && a.date.getFullYear() === now.getFullYear());
    const dates = all.map(a => a.date.getTime());
    const oldest = new Date(Math.min(...dates));
    const newest = new Date(Math.max(...dates));

    const withScore = all.filter(a => a.score !== null);
    const avgScore = withScore.length > 0
      ? withScore.reduce((sum, a) => sum + a.score!, 0) / withScore.length
      : 0;

    console.log('');
    console.log(chalk.bold('═══════════════════════════════════════════'));
    console.log(chalk.bold('         GoFluent Training Report'));
    console.log(chalk.bold('═══════════════════════════════════════════'));

    console.log('');
    console.log(chalk.bold('Period:       ') + `${this.fmtDate(oldest)} → ${this.fmtDate(newest)}`);
    console.log(chalk.bold('Total:        ') + `${all.length} attempts`);
    console.log(chalk.bold('Avg score:    ') + `${avgScore.toFixed(0)}%`);

    console.log('');
    console.log(chalk.bold(`This month (${now.toLocaleString('en', { month: 'long' })} ${now.getFullYear()}):`));
    console.log(chalk.bold('  Attempts:   ') + `${monthly.length}`);
    console.log(chalk.bold('  Valid >=80%: ') + chalk.green(`${valid.length}`));
    console.log(chalk.bold('  Failed <80%: ') + (failed.length > 0 ? chalk.red(`${failed.length}`) : '0'));
    console.log(chalk.bold('  Target:     ') + `${valid.length}/13`);

    // Score distribution for valid
    const perfect = valid.filter(a => a.score === 100);
    const good = valid.filter(a => a.score! >= 80 && a.score! < 100);
    console.log('');
    console.log(chalk.bold('Score distribution (valid):'));
    console.log(chalk.green(`  100%:    ${perfect.length}`));
    console.log(chalk.blue(`  80-99%:  ${good.length}`));

    // Activities below 80%
    if (failed.length > 0) {
      console.log('');
      console.log(chalk.bold(chalk.red('Need improvement (<80%):')));
      for (const a of failed.slice(0, 10)) {
        console.log(chalk.red(`  ${String(a.score).padStart(3)}%`) + `  ${a.title.slice(0, 45).padEnd(45)}  ${chalk.gray(this.fmtDate(a.date))}`);
      }
      if (failed.length > 10) console.log(chalk.gray(`  ... and ${failed.length - 10} more`));
    }

    // Recent valid activities
    console.log('');
    console.log(chalk.bold('Recent valid activities:'));
    for (const a of valid.slice(0, 15)) {
      const scoreColor = a.score === 100 ? chalk.green : chalk.blue;
      console.log(`  ${scoreColor(String(a.score) + '%').padEnd(15)} ${a.title.slice(0, 45).padEnd(45)}  ${chalk.gray(this.fmtDate(a.date))}`);
    }
    if (valid.length > 15) console.log(chalk.gray(`  ... and ${valid.length - 15} more`));
    console.log('');
  }

  private fmtDate(d: Date): string {
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
