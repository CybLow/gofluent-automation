import type { Page } from 'playwright';
import { SELECTORS } from '../constants/selectors.js';
import type { Urls } from '../constants/urls.js';
import { parseDateString, isCurrentMonthAndYear } from '../utils/date.js';
import type { Logger } from '../utils/logger.js';

const S = SELECTORS;

export interface ActivityInfo {
  url: string;
  date: Date;
}

export async function countMonthlyActivities(
  page: Page,
  siteUrls: Urls,
  flagAlt: string | null,
  logger: Logger,
): Promise<{ count: number; urls: string[] }> {
  logger.info('Counting monthly activities...');
  await page.goto(siteUrls.TRAINING, { waitUntil: 'domcontentloaded' });

  try {
    await page.locator(S.TRAINING.CONTAINER).waitFor({ timeout: 15_000 });
  } catch {
    logger.warn('Training page not loaded, assuming 0 activities');
    return { count: 0, urls: [] };
  }

  const activities = await paginateThroughTraining(page, siteUrls, flagAlt, logger);
  const monthly = activities.filter(a => isCurrentMonthAndYear(a.date));
  logger.info(`Found ${monthly.length} activities this month (${activities.length} total)`);

  return { count: monthly.length, urls: monthly.map(a => a.url) };
}

async function paginateThroughTraining(
  page: Page, siteUrls: Urls, flagAlt: string | null, logger: Logger,
): Promise<ActivityInfo[]> {
  const activities: ActivityInfo[] = [];
  let pageNum = 1;

  while (true) {
    logger.debug(`Scanning training page ${pageNum}`);
    await collectBlockActivities(page, siteUrls, flagAlt, logger, activities);

    if (!await goToNextPage(page)) break;
    pageNum++;
  }

  return activities;
}

async function collectBlockActivities(
  page: Page, siteUrls: Urls, flagAlt: string | null, logger: Logger, activities: ActivityInfo[],
): Promise<void> {
  const blocks = page.locator(S.TRAINING.BLOCK);
  const blockCount = await blocks.count();

  for (let i = 0; i < blockCount; i++) {
    const block = blocks.nth(i);
    const dateText = await block.locator(S.TRAINING.BLOCK_DATE).textContent();
    if (!dateText) continue;

    let date: Date;
    try {
      date = parseDateString(dateText);
    } catch {
      logger.debug(`Could not parse date: ${dateText}`);
      continue;
    }

    await collectCardActivities(block, siteUrls, flagAlt, date, activities);
  }
}

async function collectCardActivities(
  block: import('playwright').Locator, siteUrls: Urls, flagAlt: string | null, date: Date, activities: ActivityInfo[],
): Promise<void> {
  const cards = block.locator(S.TRAINING.BLOCK_CARD);
  const cardCount = await cards.count();

  for (let j = 0; j < cardCount; j++) {
    const card = cards.nth(j);

    if (flagAlt && !await matchesLanguageFlag(card, flagAlt)) continue;

    const href = await card.locator(S.TRAINING.BLOCK_CARD_LINK).getAttribute('href').catch(() => null);
    if (href) {
      activities.push({ url: `${siteUrls.BASE}${href}`, date });
    }
  }
}

async function matchesLanguageFlag(card: import('playwright').Locator, flagAlt: string): Promise<boolean> {
  try {
    const cardFlagAlt = await card.locator(S.TRAINING.BLOCK_CARD_FLAG).getAttribute('alt');
    return cardFlagAlt === flagAlt;
  } catch {
    return false;
  }
}

async function goToNextPage(page: Page): Promise<boolean> {
  const paginationItems = page.locator(`${S.TRAINING.PAGINATION} ${S.TRAINING.PAGINATION_ITEM}`);
  const paginationCount = await paginationItems.count();
  if (paginationCount === 0) return false;

  const lastButton = paginationItems.last();
  const isDisabled = await lastButton.evaluate(el => {
    return el.hasAttribute('disabled') || el.classList.contains('disabled');
  });
  if (isDisabled) return false;

  await lastButton.click({ force: true });
  await page.waitForLoadState('networkidle');
  return true;
}
