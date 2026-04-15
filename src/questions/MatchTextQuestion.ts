import type { Page, Locator } from 'playwright';
import { Question } from './Question.js';
import { SELECTORS } from '../constants/selectors.js';
import type { Logger } from '../utils/logger.js';

const S = SELECTORS.QUIZ;

export class MatchTextQuestion extends Question {
  constructor(page: Page, container: Locator, logger: Logger) {
    super(page, 'match-text', container, logger);
  }

  async asText(): Promise<string> {
    const stem = this.container.locator(S.STEM);
    const words: string[] = [];
    if (await stem.count() > 0) {
      const spans = stem.first().locator('span');
      for (let i = 0; i < await spans.count(); i++) {
        const id = await spans.nth(i).getAttribute('id');
        if (!id?.startsWith('receiver-')) {
          const text = (await spans.nth(i).textContent())?.trim();
          if (text) words.push(text);
        }
      }
    }

    const options = await this.container.locator(S.SOURCE_OPTION).allTextContents();
    const definitionList = options.map(o => `- ${o.trim()}`).join('\n');
    this.questionStr = `Match each word with its correct definition. Words in order: ${words.join(', ')}\nAvailable definitions:\n${definitionList}\nReturn ONLY the definitions (not the words) as a JSON array, in the same order as the words above.`;
    return this.questionStr;
  }

  async submitAnswer(values: string[]): Promise<void> {
    for (const value of values) {
      await this.findAndClickOption(value);
    }
    await this.fillRemainingReceivers();
  }

  protected override async getCorrectAnswer(): Promise<string[] | null> {
    const standard = await super.getCorrectAnswer();
    if (standard?.length === 1 && standard[0].includes(', ')) {
      return standard[0].split(', ');
    }
    return standard;
  }
}
