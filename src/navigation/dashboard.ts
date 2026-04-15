import type { Page } from 'playwright';
import { SELECTORS } from '../constants/selectors.js';
import type { Logger } from '../utils/logger.js';

const S = SELECTORS;

export async function dismissModals(page: Page, logger: Logger): Promise<void> {
  // Try to dismiss any modal overlays
  try {
    const skipButton = page.locator(S.DASHBOARD.MODAL_SKIP);
    if (await skipButton.isVisible({ timeout: 2_000 })) {
      await skipButton.click();
      logger.debug('Dismissed skip modal');
    }
  } catch {
    // No modal present
  }

  try {
    const backdrop = page.locator(S.DASHBOARD.MODAL_BACKDROP);
    if (await backdrop.isVisible({ timeout: 1_000 })) {
      await backdrop.click({ position: { x: 10, y: 10 } });
      logger.debug('Dismissed backdrop modal');
    }
  } catch {
    // No backdrop
  }
}
