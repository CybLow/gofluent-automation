import type { Page, Locator } from 'playwright';
import { Question } from './Question.js';
import { SELECTORS } from '../constants/selectors.js';
import type { Logger } from '../utils/logger.js';
import { normalize } from '../utils/strings.js';

const S = SELECTORS.QUIZ;

export class MultiChoiceTextQuestion extends Question {
  constructor(page: Page, container: Locator, logger: Logger) {
    super(page, 'multi-choice-text', container, logger);
  }

  async asText(): Promise<string> {
    this.questionStr = (await this.container.textContent())?.trim() ?? '';
    return this.questionStr;
  }

  async submitAnswer(values: string[]): Promise<void> {
    const value = values[0] ?? '';
    const options = this.container.locator(S.RADIO_OPTION);
    const count = await options.count();

    let clicked = false;
    for (let i = 0; i < count; i++) {
      const optionText = (await options.nth(i).textContent())?.trim() ?? '';
      if (normalize(value).includes(normalize(optionText)) || normalize(optionText).includes(normalize(value))) {
        await options.nth(i).click({ force: true });
        clicked = true;
        break;
      }
    }

    // Fallback: click first option
    if (!clicked && count > 0) {
      this.logger.debug('No matching radio option found, selecting first');
      await options.first().click({ force: true });
    }
  }

  protected override async getCorrectAnswer(): Promise<string[] | null> {
    // Try standard explanation first
    const standard = await super.getCorrectAnswer();
    if (standard) return standard;

    // Fallback: look for correctSelected radio option
    const correctOption = this.container.locator("label[role='radio'][class*='correctSelected']");
    if (await correctOption.count() > 0) {
      const text = (await correctOption.first().textContent())?.trim();
      if (text) return [text];
    }

    return null;
  }
}
