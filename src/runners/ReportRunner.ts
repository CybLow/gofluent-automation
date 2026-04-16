import { BrowserSession } from '../browser/session.js';
import { Authenticator } from '../browser/auth.js';
import { urls } from '../constants/urls.js';
import { SELECTORS } from '../constants/selectors.js';
import { parseDateString } from '../utils/date.js';
import type { AppConfig, CLIOptions } from '../types.js';
import type { Logger } from '../utils/logger.js';
import chalk from 'chalk';

const S = SELECTORS;

interface ActivityRecord {
  title: string;
  score: number | null;
  status: string;
  date: Date;
  flag: string;
}

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

      await page.goto(siteUrls.TRAINING, { waitUntil: 'domcontentloaded' });
      await page.locator(S.TRAINING.CONTAINER).waitFor({ timeout: 15_000 });

      const activities = await this.collectAllActivities(page);
      this.printReport(activities);
    } finally {
      await session.close();
      this.logger.close();
    }
  }

  private async collectAllActivities(page: import('playwright').Page): Promise<ActivityRecord[]> {
    const activities: ActivityRecord[] = [];
    let pageNum = 1;

    while (true) {
      this.logger.debug(`Scanning training page ${pageNum}`);
      const blocks = page.locator(S.TRAINING.BLOCK);
      const blockCount = await blocks.count();

      for (let i = 0; i < blockCount; i++) {
        const block = blocks.nth(i);
        const dateText = await block.locator(S.TRAINING.BLOCK_DATE).textContent();
        let date: Date;
        try { date = parseDateString(dateText?.trim() ?? ''); } catch { continue; }

        const cards = block.locator(S.TRAINING.BLOCK_CARD);
        const cardCount = await cards.count();

        for (let j = 0; j < cardCount; j++) {
          const card = cards.nth(j);
          const record = await this.parseCard(card, date);
          if (record) activities.push(record);
        }
      }

      // Next page
      const pagination = page.locator(`${S.TRAINING.PAGINATION} ${S.TRAINING.PAGINATION_ITEM}`);
      if (await pagination.count() === 0) break;
      const lastBtn = pagination.last();
      const disabled = await lastBtn.evaluate(el => el.hasAttribute('disabled') || el.classList.contains('disabled'));
      if (disabled) break;
      await lastBtn.click({ force: true });
      await page.waitForLoadState('networkidle');
      pageNum++;
    }

    return activities;
  }

  private async parseCard(card: import('playwright').Locator, date: Date): Promise<ActivityRecord | null> {
    const statusText = await card.locator('.training-card__status').textContent().catch(() => null);
    if (!statusText) return null;

    const scoreMatch = /(\d+)\s*%/.exec(statusText);
    const score = scoreMatch ? Number.parseInt(scoreMatch[1], 10) : null;
    const status = statusText.trim();

    const linkContent = await card.locator('.training-card__link').textContent().catch(() => '');
    const type = await card.locator('.training-card__type').textContent().catch(() => '');
    const title = (linkContent ?? '').replace(type ?? '', '').replace(status, '').trim();

    const flag = await card.locator("img[alt^='flag']").getAttribute('alt').catch(() => '') ?? '';

    return { title, score, status, date, flag };
  }

  private printReport(activities: ActivityRecord[]): void {
    if (activities.length === 0) {
      console.log(chalk.yellow('No activities found.'));
      return;
    }

    const now = new Date();
    const thisMonth = activities.filter(a => a.date.getMonth() === now.getMonth() && a.date.getFullYear() === now.getFullYear());
    const dates = activities.map(a => a.date.getTime());
    const oldest = new Date(Math.min(...dates));
    const newest = new Date(Math.max(...dates));

    const withScore = activities.filter(a => a.score !== null);
    const perfect = withScore.filter(a => a.score === 100);
    const good = withScore.filter(a => a.score! >= 80 && a.score! < 100);
    const bad = withScore.filter(a => a.score! < 80);
    const avgScore = withScore.length > 0
      ? withScore.reduce((sum, a) => sum + a.score!, 0) / withScore.length
      : 0;

    console.log('');
    console.log(chalk.bold('═══════════════════════════════════════════'));
    console.log(chalk.bold('         GoFluent Training Report'));
    console.log(chalk.bold('═══════════════════════════════════════════'));

    console.log('');
    console.log(chalk.bold('Period:     ') + `${this.fmtDate(oldest)} → ${this.fmtDate(newest)}`);
    console.log(chalk.bold('Total:      ') + `${activities.length} activities`);
    console.log(chalk.bold('This month: ') + `${thisMonth.length} activities`);
    console.log(chalk.bold('Avg score:  ') + `${avgScore.toFixed(0)}%`);

    console.log('');
    console.log(chalk.bold('Scores:'));
    console.log(chalk.green(`  100%     ${perfect.length}`));
    console.log(chalk.blue(`  80-99%   ${good.length}`));
    console.log(chalk.red(`  <80%     ${bad.length}`));
    if (withScore.length === 0) console.log(chalk.gray('  No scores available'));

    // This month breakdown
    if (thisMonth.length > 0) {
      const monthWithScore = thisMonth.filter(a => a.score !== null);
      const monthPerfect = monthWithScore.filter(a => a.score === 100);
      const monthGood = monthWithScore.filter(a => a.score! >= 80 && a.score! < 100);
      const monthBad = monthWithScore.filter(a => a.score! < 80);
      const monthAvg = monthWithScore.length > 0
        ? monthWithScore.reduce((sum, a) => sum + a.score!, 0) / monthWithScore.length
        : 0;

      console.log('');
      console.log(chalk.bold(`This month (${now.toLocaleString('en', { month: 'long' })} ${now.getFullYear()}):`));
      console.log(`  Total: ${thisMonth.length} | Avg: ${monthAvg.toFixed(0)}% | 100%: ${monthPerfect.length} | 80-99%: ${monthGood.length} | <80%: ${monthBad.length}`);
    }

    // Activities below 80%
    if (bad.length > 0) {
      console.log('');
      console.log(chalk.bold(chalk.red('Activities below 80%:')));
      for (const a of bad.slice(0, 10)) {
        console.log(chalk.red(`  ${a.score}%`) + ` ${a.title.slice(0, 50).padEnd(50)} ${chalk.gray(this.fmtDate(a.date))}`);
      }
      if (bad.length > 10) console.log(chalk.gray(`  ... and ${bad.length - 10} more`));
    }

    // Recent activities
    console.log('');
    console.log(chalk.bold('Recent activities:'));
    const recent = activities.slice(0, 15);
    for (const a of recent) {
      const scoreStr = a.score !== null
        ? (a.score === 100 ? chalk.green(`${a.score}%`) : a.score >= 80 ? chalk.blue(`${a.score}%`) : chalk.red(`${a.score}%`))
        : chalk.gray('N/A');
      console.log(`  ${scoreStr.padEnd(15)} ${a.title.slice(0, 45).padEnd(45)} ${chalk.gray(this.fmtDate(a.date))}`);
    }
    if (activities.length > 15) console.log(chalk.gray(`  ... and ${activities.length - 15} more`));

    console.log('');
  }

  private fmtDate(d: Date): string {
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
