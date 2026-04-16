import type { Page } from 'playwright';
import { SELECTORS } from '../constants/selectors.js';
import type { Urls } from '../constants/urls.js';
import { parseDateString, isCurrentMonthAndYear } from '../utils/date.js';
import type { Logger } from '../utils/logger.js';

const S = SELECTORS;

export interface ActivityInfo {
  url: string;
  date: Date;
  score: number | null;
  title: string;
}

export interface TrainingReport {
  all: ActivityInfo[];
  monthly: ActivityInfo[];
  monthlyValid: ActivityInfo[];   // score >= 80%
  monthlyFailed: ActivityInfo[];  // score < 80%
}

export async function scanTrainingPage(
  page: Page,
  siteUrls: Urls,
  flagAlt: string | null,
  logger: Logger,
): Promise<TrainingReport> {
  logger.info('Scanning training page...');
  await page.goto(siteUrls.TRAINING, { waitUntil: 'domcontentloaded' });

  try {
    await page.locator(S.TRAINING.CONTAINER).waitFor({ timeout: 15_000 });
  } catch {
    logger.warn('Training page not loaded');
    return { all: [], monthly: [], monthlyValid: [], monthlyFailed: [] };
  }

  const all = await paginateThroughTraining(page, siteUrls, flagAlt, logger);
  const monthly = all.filter(a => isCurrentMonthAndYear(a.date));

  // Deduplicate by URL — keep the BEST score per activity
  const bestByUrl = new Map<string, ActivityInfo>();
  for (const a of monthly) {
    const existing = bestByUrl.get(a.url);
    if (!existing || (a.score ?? 0) > (existing.score ?? 0)) {
      bestByUrl.set(a.url, a);
    }
  }
  const deduped = [...bestByUrl.values()];

  const monthlyValid = deduped.filter(a => a.score !== null && a.score >= 80);
  const monthlyFailed = deduped.filter(a => a.score !== null && a.score < 80);

  logger.info(`Training: ${deduped.length} unique this month (${monthlyValid.length} valid >=80%, ${monthlyFailed.length} failed <80%)`);

  return { all, monthly, monthlyValid, monthlyFailed };
}

async function paginateThroughTraining(
  page: Page, siteUrls: Urls, flagAlt: string | null, logger: Logger,
): Promise<ActivityInfo[]> {
  const activities: ActivityInfo[] = [];
  let pageNum = 1;

  while (true) {
    logger.debug(`Scanning training page ${pageNum}`);
    await collectBlockActivities(page, siteUrls, flagAlt, activities);

    if (!await goToNextPage(page)) break;
    pageNum++;
  }

  return activities;
}

async function collectBlockActivities(
  page: Page, siteUrls: Urls, flagAlt: string | null, activities: ActivityInfo[],
): Promise<void> {
  const blocks = page.locator(S.TRAINING.BLOCK);

  for (let i = 0; i < await blocks.count(); i++) {
    const block = blocks.nth(i);
    const dateText = await block.locator(S.TRAINING.BLOCK_DATE).textContent();
    let date: Date;
    try { date = parseDateString(dateText?.trim() ?? ''); } catch { continue; }

    const cards = block.locator(S.TRAINING.BLOCK_CARD);
    for (let j = 0; j < await cards.count(); j++) {
      const card = cards.nth(j);
      if (flagAlt && !await matchesFlag(card, flagAlt)) continue;

      const href = await card.locator(S.TRAINING.BLOCK_CARD_LINK).getAttribute('href').catch(() => null);
      if (!href) continue;

      // Extract score from status text (e.g. "83% - Validé")
      const statusText = await card.locator('.training-card__status').textContent().catch(() => '');
      const scoreMatch = /(\d+)\s*%/.exec(statusText ?? '');
      const score = scoreMatch ? Number.parseInt(scoreMatch[1], 10) : null;

      // Extract title
      const linkText = await card.locator('.training-card__link').textContent().catch(() => '');
      const typeText = await card.locator('.training-card__type').textContent().catch(() => '');
      const title = (linkText ?? '').replace(typeText ?? '', '').replace(statusText ?? '', '').trim();

      activities.push({ url: `${siteUrls.BASE}${href}`, date, score, title });
    }
  }
}

async function matchesFlag(card: import('playwright').Locator, flagAlt: string): Promise<boolean> {
  try {
    return (await card.locator("img[alt^='flag']").getAttribute('alt')) === flagAlt;
  } catch { return false; }
}

async function goToNextPage(page: Page): Promise<boolean> {
  const items = page.locator(`${S.TRAINING.PAGINATION} ${S.TRAINING.PAGINATION_ITEM}`);
  if (await items.count() === 0) return false;

  const last = items.last();
  const disabled = await last.evaluate(el => el.hasAttribute('disabled') || el.classList.contains('disabled'));
  if (disabled) return false;

  await last.click({ force: true });
  // Wait for cards to update instead of full networkidle
  await page.locator(S.TRAINING.BLOCK).first().waitFor({ timeout: 5_000 }).catch(() => {});
  return true;
}
