import type { Page, Locator } from 'playwright';
import { Question } from './Question.js';
import { SELECTORS } from '../constants/selectors.js';
import type { Logger } from '../utils/logger.js';
import { normalize, bestMatchIndex } from '../utils/strings.js';

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
    if (count === 0) return;

    const optionTexts: string[] = [];
    for (let i = 0; i < count; i++) {
      optionTexts.push((await options.nth(i).textContent())?.trim() ?? '');
    }

    // Try exact normalized match (includes)
    for (let i = 0; i < optionTexts.length; i++) {
      const nv = normalize(value);
      const no = normalize(optionTexts[i]);
      if (nv === no || nv.includes(no) || no.includes(nv)) {
        await options.nth(i).click({ force: true });
        return;
      }
    }

    // Try fuzzy best match (handles punctuation/encoding diffs)
    const best = bestMatchIndex(value, optionTexts, 0.5);
    if (best !== null) {
      this.logger.debug(`Fuzzy matched option ${best}: "${optionTexts[best].slice(0, 60)}"`);
      await options.nth(best).click({ force: true });
      return;
    }

    // Last resort: first option
    this.logger.debug('No matching radio option found, selecting first');
    await options.first().click({ force: true });
  }

  protected override async getCorrectAnswer(): Promise<string[] | null> {
    const standard = await super.getCorrectAnswer();
    if (standard) return standard;

    const correctOption = this.container.locator("label[role='radio'][class*='correctSelected']");
    if (await correctOption.count() > 0) {
      const text = (await correctOption.first().textContent())?.trim();
      if (text) return [text];
    }

    return null;
  }
}
