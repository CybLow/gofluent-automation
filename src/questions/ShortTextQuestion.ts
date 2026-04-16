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
    const textareas = this.container.locator('textarea');
    const count = await textareas.count();
    if (count === 1) {
      await textareas.fill(values[0] ?? '');
    } else {
      // Multiple textareas — fill each with corresponding value
      for (let i = 0; i < count; i++) {
        await textareas.nth(i).fill(values[i] ?? values[0] ?? '');
      }
    }
  }
}
