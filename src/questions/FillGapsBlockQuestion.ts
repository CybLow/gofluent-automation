import type { Page, Locator } from 'playwright';
import { Question } from './Question.js';
import { SELECTORS } from '../constants/selectors.js';
import type { Logger } from '../utils/logger.js';

const S = SELECTORS.QUIZ;

export class FillGapsBlockQuestion extends Question {
  constructor(page: Page, container: Locator, logger: Logger) {
    super(page, 'fill-gaps-block', container, logger);
  }

  async asText(): Promise<string> {
    const stemText = await this.getStemText();
    const options = await this.container.locator(S.SOURCE_OPTION).allTextContents();
    const optionList = options.map(o => '- ' + o.trim()).join('\n');
    this.questionStr = stemText + '\n' + optionList;
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
