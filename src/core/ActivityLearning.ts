import type { Page } from 'playwright';
import { SELECTORS } from '../constants/selectors.js';
import { getDataFromSection } from '../utils/parser.js';
import type { Activity } from './Activity.js';
import type { Logger } from '../utils/logger.js';

const S = SELECTORS;

export class ActivityLearning {
  constructor(
    private readonly logger: Logger,
    private readonly page: Page,
    private readonly activity: Activity,
  ) {}

  async retrieveActivityData(): Promise<void> {
    this.logger.info('Extracting learning data...');

    await this.page.goto(this.activity.url, { waitUntil: 'domcontentloaded' });

    // Wait for navigation tabs
    try {
      await this.page.locator(S.NAV.TABS).waitFor({ timeout: 30_000 });
    } catch {
      this.logger.warn('Navigation tabs not found, skipping learning data');
      return;
    }

    // Click learning tab
    const learningTab = this.page.locator(S.NAV.LEARNING_TAB);
    if (await learningTab.isVisible().catch(() => false)) {
      await learningTab.click();
      await this.page.locator(S.LEARNING.SIDEBAR).or(this.page.locator(S.NAV.QUIZ_TAB)).waitFor({ timeout: 5_000 }).catch(() => {});
    }

    // Check if sidebar exists
    const sidebar = this.page.locator(S.LEARNING.SIDEBAR);
    if (!await sidebar.isVisible({ timeout: 3_000 }).catch(() => false)) {
      this.logger.debug('No learning sidebar found');
      return;
    }

    // Iterate through each learning tab
    const tabs = this.page.locator(S.LEARNING.SIDEBAR_ITEM);
    const tabCount = await tabs.count();
    this.logger.debug(`Found ${tabCount} learning tabs`);

    for (let i = 0; i < tabCount; i++) {
      try {
        await tabs.nth(i).click();
        // Wait for section content to load
        await this.page.locator(S.LEARNING.SECTION).waitFor({ timeout: 3_000 }).catch(() => {});

        // Get section HTML
        const section = this.page.locator(S.LEARNING.SECTION);
        if (await section.isVisible({ timeout: 3_000 }).catch(() => false)) {
          const html = await section.innerHTML();
          const data = getDataFromSection(html);
          if (data) {
            this.activity.data.push(data);
            this.logger.debug(`Extracted ${data.type} section`);
          }
        }
      } catch (e) {
        this.logger.debug(`Failed to extract tab ${i}: ${e}`);
      }
    }

    this.logger.info(`Extracted ${this.activity.data.length} learning sections`);
  }
}
