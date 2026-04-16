import type { Page, Locator } from 'playwright';
import { Question, clickOptionAndWait } from './Question.js';
import { SELECTORS } from '../constants/selectors.js';
import type { Logger } from '../utils/logger.js';

const S = SELECTORS.QUIZ;

export class ScrambledLettersQuestion extends Question {
  constructor(page: Page, container: Locator, logger: Logger) {
    super(page, 'scrambled-letters', container, logger);
  }

  async asText(): Promise<string> {
    const text = (await this.container.textContent())?.trim() ?? '';
    this.questionStr = `${text} are the letters you can use, you NEED to use every letters`;
    return this.questionStr;
  }

  async submitAnswer(values: string[]): Promise<void> {
    // API returns individual chars ["C","O","M","B","I","N","E","D"] or a single word ["COMBINED"]
    const chars = values.every(v => v.length <= 1)
      ? values.map(v => v.toUpperCase())
      : [...(values[0] ?? '').toUpperCase()];

    for (const char of chars) {
      const options = this.container.locator(S.SOURCE_OPTION);
      const count = await options.count();

      let clicked = false;
      for (let i = 0; i < count; i++) {
        const optionText = (await options.nth(i).textContent())?.trim().toUpperCase();
        if (optionText === char) {
          await clickOptionAndWait(this.container, options.nth(i), this.page);
          clicked = true;
          break;
        }
      }

      if (!clicked && count > 0) {
        await clickOptionAndWait(this.container, options.first(), this.page);
      }
    }

    // Fill remaining receivers
    await this.fillRemainingReceivers();
  }


  protected override async getCorrectAnswer(): Promise<string[] | null> {
    const standard = await super.getCorrectAnswer();
    const first = standard?.[0]?.trim();
    if (standard?.length === 1 && first) {
      return [first];
    }
    return standard;
  }
}
