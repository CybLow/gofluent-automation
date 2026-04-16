import type { Page, Locator } from 'playwright';
import type { QuestionType } from '../types.js';
import type { Logger } from '../utils/logger.js';
import { isFeedbackText } from '../utils/strings.js';
import { SELECTORS } from '../constants/selectors.js';

const S = SELECTORS.QUIZ;

/** Click a source option and wait for the option count to decrease (= option moved to receiver) */
export async function clickOptionAndWait(container: Locator, option: Locator, page: Page): Promise<void> {
  const before = await container.locator(S.SOURCE_OPTION).count();
  await option.click({ force: true });
  // Wait up to 1s for option count to change (DOM updated)
  for (let i = 0; i < 10; i++) {
    const after = await container.locator(S.SOURCE_OPTION).count();
    if (after < before) return;
    await page.waitForTimeout(50);
  }
}

export abstract class Question {
  readonly type: QuestionType;
  protected container: Locator;
  protected page: Page;
  protected logger: Logger;

  questionStr = '';
  skipCompletion = false;

  protected constructor(page: Page, type: QuestionType, container: Locator, logger: Logger) {
    this.page = page;
    this.type = type;
    this.container = container;
    this.logger = logger;
  }

  abstract asText(): Promise<string>;
  abstract submitAnswer(values: string[]): Promise<void>;

  /** Get stem text or fallback to full container text */
  protected async getStemText(): Promise<string> {
    const stem = this.container.locator(S.STEM);
    if (await stem.count() > 0) {
      return (await stem.first().textContent())?.trim() ?? '';
    }
    return (await this.container.textContent())?.trim() ?? '';
  }

  /** Find an option by fuzzy/best match and click it. Returns true if clicked. */
  protected async findAndClickOption(value: string): Promise<boolean> {
    const { fuzzyMatch, bestMatchIndex } = await import('../utils/strings.js');
    const options = this.container.locator(S.SOURCE_OPTION);
    const count = await options.count();
    if (count === 0) return false;

    const texts = await options.allTextContents();
    let idx = -1;

    for (let i = 0; i < texts.length; i++) {
      if (fuzzyMatch(value, texts[i].trim())) { idx = i; break; }
    }
    if (idx === -1) {
      const best = bestMatchIndex(value, texts.map(t => t.trim()));
      if (best !== null) idx = best;
    }

    const target = idx >= 0 && idx < count ? options.nth(idx) : options.first();
    await clickOptionAndWait(this.container, target, this.page);
    return true;
  }

  /** Fill all empty receivers with remaining source options */
  protected async fillRemainingReceivers(): Promise<void> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const receivers = this.container.locator(S.RECEIVER);
      let hasEmpty = false;
      for (let i = 0; i < await receivers.count(); i++) {
        if (!(await receivers.nth(i).textContent())?.trim()) { hasEmpty = true; break; }
      }
      if (!hasEmpty) break;
      const options = this.container.locator(S.SOURCE_OPTION);
      if (await options.count() === 0) break;
      await clickOptionAndWait(this.container, options.first(), this.page);
    }
  }

  async answer(values: string[]): Promise<string[]> {
    await this.submitAnswer(values);
    return this.submitAndCheckCorrectAnswer(values);
  }

  protected async submitAndCheckCorrectAnswer(values: string[]): Promise<string[]> {
    // Click submit button
    const submitInContainer = this.container.locator(S.SUBMIT);
    const submitOnPage = this.page.locator(S.SUBMIT);
    const submitButton = (await submitInContainer.count() > 0) ? submitInContainer : submitOnPage;

    try {
      await submitButton.click({ force: true });
    } catch (e) {
      this.logger.warn(`Submit button click failed: ${e}`);
      return values;
    }

    // Wait for "next" button (indicates post-submit state)
    await this.page.locator(S.NEXT).waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});

    const correct = await this.getCorrectAnswer();
    if (correct && correct.length > 0) {
      return correct;
    }
    return values;
  }

  protected async getCorrectAnswer(): Promise<string[] | null> {
    for (const scope of [this.container, this.page]) {
      const listResult = await this.findAnswerInScope(scope, S.CORRECT_ANSWER_LIST);
      if (listResult) return listResult;
    }

    for (const scope of [this.container, this.page]) {
      const titleResult = await this.findTitleAnswerInScope(scope);
      if (titleResult) return titleResult;
    }

    return null;
  }

  private async findAnswerInScope(scope: import('playwright').Locator | import('playwright').Page, selector: string): Promise<string[] | null> {
    const listItems = scope.locator(selector);
    const count = await listItems.count();
    if (count === 0) return null;

    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = (await listItems.nth(i).textContent())?.trim();
      if (text && !isFeedbackText(text)) texts.push(text);
    }
    return texts.length > 0 ? texts : null;
  }

  private async findTitleAnswerInScope(scope: import('playwright').Locator | import('playwright').Page): Promise<string[] | null> {
    const title = scope.locator(S.CORRECT_ANSWER_TITLE);
    if (await title.count() > 0) {
      const text = (await title.first().textContent())?.trim();
      if (text && !isFeedbackText(text)) return [text];
    }
    return null;
  }

  static async fromElement(page: Page, container: Locator, logger: Logger): Promise<Question | null> {
    const has = async (css: string) => (await container.locator(css).count()) > 0;

    if (await has("label[role='radio']")) {
      return await has("label[role='radio'] img")
        ? new (await import('./MultiChoiceImageQuestion.js')).MultiChoiceImageQuestion(page, container, logger)
        : new (await import('./MultiChoiceTextQuestion.js')).MultiChoiceTextQuestion(page, container, logger);
    }
    if (await has("li[role='checkbox']"))
      return new (await import('./MultiChoiceCheckboxQuestion.js')).MultiChoiceCheckboxQuestion(page, container, logger);
    if (await has('textarea'))
      return new (await import('./ShortTextQuestion.js')).ShortTextQuestion(page, container, logger);
    if (await has("input[type='text']"))
      return new (await import('./FillGapsTextQuestion.js')).FillGapsTextQuestion(page, container, logger);
    if (await has('#source-container'))
      return this.detectDragDropType(page, container, logger);

    logger.warn('Unknown question type');
    return null;
  }

  private static async detectDragDropType(page: Page, container: Locator, logger: Logger): Promise<Question> {
    const optionTexts = await container.locator(S.SOURCE_OPTION).allTextContents();

    if (optionTexts.length > 0 && optionTexts.every(t => t.trim().length <= 1))
      return new (await import('./ScrambledLettersQuestion.js')).ScrambledLettersQuestion(page, container, logger);

    const receiverCount = await container.locator(S.RECEIVER).count();

    if (receiverCount >= 1) {
      // Check if receivers are INSIDE the stem (fill-gaps) or outside (scrambled/match)
      const stem = container.locator(S.STEM);
      const receiverInStem = (await stem.count()) > 0
        ? await stem.first().locator(S.RECEIVER).count()
        : 0;

      if (receiverInStem > 0) {
        // Receivers inline in stem = fill-gaps-block or match-text
        const hasTextLabels = await this.stemHasTextLabels(container);
        return hasTextLabels
          ? new (await import('./MatchTextQuestion.js')).MatchTextQuestion(page, container, logger)
          : new (await import('./FillGapsBlockQuestion.js')).FillGapsBlockQuestion(page, container, logger);
      }
    }

    // No receivers in stem = scrambled sentences (assemble words into order)
    return new (await import('./ScrambledSentencesQuestion.js')).ScrambledSentencesQuestion(page, container, logger);
  }

  private static async stemHasTextLabels(container: Locator): Promise<boolean> {
    const stem = container.locator(S.STEM);
    if (await stem.count() === 0) return false;
    const spans = stem.first().locator('span');
    for (let i = 0; i < await spans.count(); i++) {
      const id = await spans.nth(i).getAttribute('id');
      if (!id?.startsWith('receiver-')) {
        const text = (await spans.nth(i).textContent())?.trim();
        if (text) return true;
      }
    }
    return false;
  }
}
