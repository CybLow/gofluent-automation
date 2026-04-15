import type { Page, Locator } from 'playwright';
import { Question } from './Question.js';
import type { Logger } from '../utils/logger.js';

export class ShortTextQuestion extends Question {
  constructor(page: Page, container: Locator, logger: Logger) {
    super(page, 'short-text', container, logger);
  }

  async asText(): Promise<string> {
    this.questionStr = await this.getStemText();
    return this.questionStr;
  }

  async submitAnswer(values: string[]): Promise<void> {
    await this.container.locator('textarea').fill(values[0] ?? '');
  }
}
