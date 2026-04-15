import type { Page, Locator } from 'playwright';
import { Question } from './Question.js';
import { SELECTORS } from '../constants/selectors.js';
import type { Logger } from '../utils/logger.js';

const S = SELECTORS.QUIZ;

export class MultiChoiceImageQuestion extends Question {
  constructor(page: Page, container: Locator, logger: Logger) {
    super(page, 'multi-choice-image', container, logger);
    this.skipCompletion = true;
  }

  async asText(): Promise<string> {
    this.questionStr = (await this.container.textContent())?.trim() ?? '';
    return this.questionStr;
  }

  async submitAnswer(values: string[]): Promise<void> {
    const options = this.container.locator(S.RADIO_OPTION);
    const count = await options.count();

    if (values[0] && values[0] !== 'SKIP') {
      // Try to match by image src
      for (let i = 0; i < count; i++) {
        const img = options.nth(i).locator('img');
        if (await img.count() > 0) {
          const src = await img.getAttribute('src');
          if (src && (src.includes(values[0]) || values[0].includes(src))) {
            await options.nth(i).click({ force: true });
            return;
          }
        }
      }
    }

    // Select random option
    if (count > 0) {
      const randomIndex = Math.floor(Math.random() * count);
      await options.nth(randomIndex).click({ force: true });
    }
  }

  protected override async getCorrectAnswer(): Promise<string[] | null> {
    const standard = await super.getCorrectAnswer();
    if (standard) return standard;

    // Fallback: get correct image src
    const correctOption = this.container.locator("label[role='radio'][class*='correctSelected'] img");
    if (await correctOption.count() > 0) {
      const src = await correctOption.first().getAttribute('src');
      if (src) {
        // Strip base URL
        return [src.replace('https://esaip.gofluent.com', '')];
      }
    }

    return null;
  }
}
