import type { Page, Locator } from 'playwright';
import { Question, clickOptionAndWait } from './Question.js';
import { SELECTORS } from '../constants/selectors.js';
import type { Logger } from '../utils/logger.js';
import { normalize, fuzzyMatch, bestMatchIndex } from '../utils/strings.js';

const S = SELECTORS.QUIZ;

export class ScrambledSentencesQuestion extends Question {
  constructor(page: Page, container: Locator, logger: Logger) {
    super(page, 'scrambled-sentences', container, logger);
  }

  async asText(): Promise<string> {
    const stem = this.container.locator(S.STEM);
    const stemText = await stem.count() > 0
      ? (await stem.first().textContent())?.trim() ?? ''
      : '';

    const options = await this.getOptionTexts();
    // Sort alphabetically for consistent cache key
    const sorted = [...options].sort((a, b) => a.localeCompare(b));
    const optionList = sorted.map(o => `- ${o}`).join('\n');

    this.questionStr = `${stemText}\n${optionList}`;
    return this.questionStr;
  }

  async submitAnswer(values: string[]): Promise<void> {
    await this.container.locator(S.SOURCE_OPTION).first().waitFor({ timeout: 5_000 }).catch(() => {});

    const optionTexts = await this.getOptionTexts();
    const isMultiWord = optionTexts.some(o => o.includes(' '));

    const adjustedValues = (isMultiWord && values.length > optionTexts.length)
      ? [values.join(' ')]
      : values;

    for (const value of adjustedValues) {
      await this.clickMatchingOption(value, isMultiWord);
    }

    if (adjustedValues.length >= optionTexts.length) {
      await this.fillRemainingReceivers();
    }
  }

  private async clickMatchingOption(value: string, isMultiWord: boolean): Promise<void> {
    const options = this.container.locator(S.SOURCE_OPTION);
    const count = await options.count();
    if (count === 0) return;

    const currentTexts = await options.allTextContents();
    let clickIndex = this.findMatchIndex(value, currentTexts, isMultiWord);

    if (clickIndex === -1) {
      const best = bestMatchIndex(value, currentTexts.map(t => t.trim()));
      if (best !== null) clickIndex = best;
    }

    const target = (clickIndex >= 0 && clickIndex < count) ? options.nth(clickIndex) : options.first();
    await clickOptionAndWait(this.container, target, this.page);
  }

  private findMatchIndex(value: string, currentTexts: string[], isMultiWord: boolean): number {
    for (let i = 0; i < currentTexts.length; i++) {
      const matches = isMultiWord
        ? normalize(value) === normalize(currentTexts[i])
        : fuzzyMatch(value, currentTexts[i].trim());
      if (matches) return i;
    }
    return -1;
  }

  private async getOptionTexts(): Promise<string[]> {
    const options = this.container.locator(S.SOURCE_OPTION);
    return (await options.allTextContents()).map(t => t.trim()).filter(Boolean);
  }

}
