import type { Page, Locator } from 'playwright';
import { Question } from './Question.js';
import type { Logger } from '../utils/logger.js';
import { normalize } from '../utils/strings.js';

export class MultiChoiceCheckboxQuestion extends Question {
  constructor(page: Page, container: Locator, logger: Logger) {
    super(page, 'multi-choice-checkbox', container, logger);
  }

  async asText(): Promise<string> {
    this.questionStr = (await this.container.textContent())?.trim() ?? '';
    return this.questionStr;
  }

  async submitAnswer(values: string[]): Promise<void> {
    const options = this.container.locator("li[role='checkbox']");
    const count = await options.count();

    for (const value of values) {
      for (let i = 0; i < count; i++) {
        const optionText = (await options.nth(i).textContent())?.trim() ?? '';
        if (normalize(value).includes(normalize(optionText)) || normalize(optionText).includes(normalize(value))) {
          await options.nth(i).click({ force: true });
          // Wait for checkbox state to update
          await options.nth(i).locator("[aria-checked='true'], [data-checked]").waitFor({ timeout: 1_000 }).catch(() => {});
          break;
        }
      }
    }

    // If nothing was clicked, click the first option as fallback
    const checked = this.container.locator("li[role='checkbox'][aria-checked='true']");
    if (await checked.count() === 0 && count > 0) {
      this.logger.debug('No checkbox matched, selecting first option');
      await options.first().click({ force: true });
    }
  }
}
