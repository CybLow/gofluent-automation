import type { Page, Locator } from 'playwright';
import { Question } from './Question.js';
import type { Logger } from '../utils/logger.js';

export class FillGapsTextQuestion extends Question {
  constructor(page: Page, container: Locator, logger: Logger) {
    super(page, 'fill-gaps-text', container, logger);
  }

  async asText(): Promise<string> {
    this.questionStr = await this.getStemText();
    return this.questionStr;
  }

  async submitAnswer(values: string[]): Promise<void> {
    const inputs = this.container.locator("input[type='text']");
    let valueIdx = 0;

    for (let i = 0; i < await inputs.count(); i++) {
      if ((await inputs.nth(i).inputValue()).trim() === '') {
        await inputs.nth(i).fill(values[valueIdx++] ?? 'abcdef');
      }
    }
  }
}
