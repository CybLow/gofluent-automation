import type { Page } from 'playwright';
import { SELECTORS } from '../constants/selectors.js';
import type { Urls } from '../constants/urls.js';
import type { Logger } from '../utils/logger.js';

const S = SELECTORS;

export interface LanguageInfo {
  flagAlt: string | null;
}

export async function ensureLanguage(
  page: Page,
  targetLanguage: string,
  siteUrls: Urls,
  logger: Logger,
): Promise<LanguageInfo> {
  logger.info(`Setting language to: ${targetLanguage}`);
  await page.goto(siteUrls.PROFILE, { waitUntil: 'domcontentloaded' });

  // Wait for language item to load
  await page.locator(S.PROFILE.LANGUAGE_ITEM).waitFor({ timeout: 20_000 });

  // Read current language
  const languageItem = page.locator(S.PROFILE.LANGUAGE_ITEM);
  const currentLanguage = await languageItem.locator(S.PROFILE.LANGUAGE_VALUE).textContent();

  if (currentLanguage?.trim().toLowerCase() === targetLanguage.toLowerCase()) {
    logger.success(`Language already set to ${targetLanguage}`);
    const flagAlt = await languageItem.locator(S.PROFILE.LANGUAGE_FLAG).getAttribute('alt');
    return { flagAlt };
  }

  // Click on language item to edit
  await languageItem.click();
  await page.locator(S.PROFILE.LANGUAGE_COMBOBOX).waitFor({ timeout: 3_000 }).catch(() => {});

  // Open dropdown
  const dropdownButton = page.locator(S.PROFILE.LANGUAGE_OPEN_BUTTON);
  await dropdownButton.click();
  await page.locator(S.PROFILE.LANGUAGE_OPTION).first().waitFor({ timeout: 3_000 }).catch(() => {});

  // Find and click target language option
  const options = page.locator(S.PROFILE.LANGUAGE_OPTION);
  const count = await options.count();

  let found = false;
  for (let i = 0; i < count; i++) {
    const optionText = await options.nth(i).textContent();
    if (optionText?.trim().toLowerCase() === targetLanguage.toLowerCase()) {
      await options.nth(i).click();
      found = true;
      break;
    }
  }

  if (!found) {
    throw new Error(`Language "${targetLanguage}" not found in dropdown options`);
  }

  // Reload profile to get flag info
  await page.goto(siteUrls.PROFILE, { waitUntil: 'domcontentloaded' });
  await page.locator(S.PROFILE.LANGUAGE_ITEM).waitFor({ timeout: 15_000 });

  const flagAlt = await page.locator(S.PROFILE.LANGUAGE_ITEM)
    .locator(S.PROFILE.LANGUAGE_FLAG)
    .getAttribute('alt');

  logger.success(`Language set to ${targetLanguage}`);
  return { flagAlt };
}
