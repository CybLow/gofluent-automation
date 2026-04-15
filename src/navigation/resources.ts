import type { Page } from 'playwright';
import * as cheerio from 'cheerio';
import { SELECTORS } from '../constants/selectors.js';
import { getCategoryUrl, type Urls, type ActivityCategory } from '../constants/urls.js';
import type { CEFRLevel } from '../types.js';
import { CEFR_ORDER } from '../types.js';
import type { Logger } from '../utils/logger.js';

const S = SELECTORS;

export interface DiscoverOptions {
  minimumLevel?: CEFRLevel;
  maximumLevel?: CEFRLevel;
}

/**
 * Discovers activity URLs from the vocabulary or grammar resources page.
 * Mirrors the reference Python `retrieve_and_do_activities` recursive pattern:
 *   1. Navigate to page (only if not already there)
 *   2. Parse current container HTML with cheerio (like BeautifulSoup)
 *   3. If none found → scroll + retry (up to maxScrollRounds)
 *   4. Return found URLs
 */
export async function discoverActivities(
  page: Page,
  siteUrls: Urls,
  category: ActivityCategory,
  cachedUrls: Set<string>,
  options: DiscoverOptions,
  logger: Logger,
): Promise<string[]> {
  const targetUrl = getCategoryUrl(siteUrls, category);
  logger.info(`Discovering ${category} activities...`);

  if (!await navigateToCategory(page, targetUrl, category, logger)) {
    return [];
  }

  // Phase 1: Try parsing the initial page
  const initialUrls = await parseCurrentPage(page, siteUrls.BASE, cachedUrls, options);
  if (initialUrls.length > 0) {
    logger.info(`Found ${initialUrls.length} new ${category} activities (no scroll needed)`);
    return initialUrls;
  }

  // Phase 2: Scroll to load more and parse periodically
  const scrolledUrls = await scrollAndDiscover(page, siteUrls.BASE, cachedUrls, options, category, logger);
  return scrolledUrls;
}

async function navigateToCategory(
  page: Page, targetUrl: string, category: ActivityCategory, logger: Logger,
): Promise<boolean> {
  const currentPath = new URL(page.url()).pathname;
  const targetPath = new URL(targetUrl).pathname;
  if (currentPath !== targetPath) {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  }

  try {
    await page.locator(S.RESOURCES.ACTIVITIES_LIST).waitFor({ timeout: 15_000 });
    return true;
  } catch {
    logger.warn(`${category} activities list not found on page`);
    return false;
  }
}

async function parseCurrentPage(
  page: Page, baseUrl: string, cachedUrls: Set<string>, options: DiscoverOptions,
): Promise<string[]> {
  const containerHtml = await page.locator(S.RESOURCES.ACTIVITIES_LIST).evaluate(el => el.outerHTML);
  return parseActivityUrls(containerHtml, baseUrl, cachedUrls, options);
}

async function scrollAndDiscover(
  page: Page, baseUrl: string, cachedUrls: Set<string>, options: DiscoverOptions,
  category: ActivityCategory, logger: Logger,
): Promise<string[]> {
  const maxScrollRounds = 20;
  let prevItemCount = 0;
  let staleRounds = 0;

  for (let round = 1; round <= maxScrollRounds; round++) {
    await performScrollRound(page);

    const currentCount = await page.locator('li.ResourcesList__item').count();
    logger.debug(`Scroll round ${round}: ${currentCount} items loaded`);

    if (currentCount === prevItemCount) {
      staleRounds++;
      if (staleRounds >= 3) {
        logger.debug('No more items loading, stopping scroll');
        break;
      }
    } else {
      staleRounds = 0;
      prevItemCount = currentCount;
    }

    if (round % 3 === 0 || staleRounds >= 2) {
      const urls = await parseCurrentPage(page, baseUrl, cachedUrls, options);
      if (urls.length > 0) {
        logger.info(`Found ${urls.length} new ${category} activities after ${round} scroll rounds`);
        return urls;
      }
    }
  }

  const finalUrls = await parseCurrentPage(page, baseUrl, cachedUrls, options);
  if (finalUrls.length > 0) {
    logger.info(`Found ${finalUrls.length} new ${category} activities`);
    return finalUrls;
  }

  logger.warn(`No ${category} activities found after scrolling`);
  return [];
}

async function performScrollRound(page: Page): Promise<void> {
  const countBefore = await page.locator('li.ResourcesList__item').count();
  for (let i = 0; i < 3; i++) {
    await scrollForMore(page);
  }
  for (let wait = 0; wait < 10; wait++) {
    const countNow = await page.locator('li.ResourcesList__item').count();
    if (countNow > countBefore) break;
    await page.waitForTimeout(100);
  }
}

/**
 * Parse activity URLs from container HTML using cheerio.
 * Exact mirror of reference Python `get_urls_from_activities_container()`:
 *   - li.ResourcesList__item     → each activity
 *   - .resource-link[href]       → the link
 *   - div.resource-link__done-icon (has children when done)
 *   - .resource-link__tags       → CEFR level text "A1 - B2"
 */
function parseActivityUrls(
  containerHtml: string,
  baseUrl: string,
  cachedUrls: Set<string>,
  options: DiscoverOptions,
): string[] {
  const $ = cheerio.load(containerHtml);
  const results: string[] = [];

  $('li.ResourcesList__item').each((_i, li) => {
    const $li = $(li);

    const link = $li.find('.resource-link');
    const href = link.attr('href');
    if (!href) return;

    if (isFilteredByCefrLevel($li, $, options)) return;

    const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
    if (cachedUrls.has(fullUrl)) return;

    results.push(fullUrl);
  });

  return results;
}

function isFilteredByCefrLevel(
  $li: cheerio.Cheerio<import('domhandler').Element>,
  $: cheerio.CheerioAPI,
  options: DiscoverOptions,
): boolean {
  if (!options.minimumLevel && !options.maximumLevel) return false;

  const tagsEl = $li.find('.resource-link__tags');
  if (tagsEl.length === 0) return false;

  const levelText = tagsEl.text().trim();
  const levels = levelText.split('-').map(l => l.trim().toUpperCase());

  const minOrder = options.minimumLevel ? CEFR_ORDER[options.minimumLevel] : undefined;
  const maxOrder = options.maximumLevel ? CEFR_ORDER[options.maximumLevel] : undefined;

  const firstLevel = levels[0] as CEFRLevel;
  const lastLevel = levels.at(-1) as CEFRLevel;

  if (maxOrder !== undefined && CEFR_ORDER[lastLevel] !== undefined) {
    if (CEFR_ORDER[lastLevel] > maxOrder) return true;
  }
  if (minOrder !== undefined && CEFR_ORDER[firstLevel] !== undefined) {
    if (CEFR_ORDER[firstLevel] < minOrder) return true;
  }
  return false;
}

async function scrollForMore(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Scroll ALL scrollable containers — don't return early
    document.querySelectorAll(
      '.browse-all-activities__list, .browse-all-activities .rcs-inner-container'
    ).forEach(el => {
      el.scrollTop = el.scrollHeight;
    });
    window.scrollTo(0, document.body.scrollHeight);
  });
}
