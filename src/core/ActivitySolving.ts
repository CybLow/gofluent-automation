import type { Page } from 'playwright';
import { writeFileSync } from 'node:fs';
import { SELECTORS } from '../constants/selectors.js';
import { Question } from '../questions/Question.js';
import { getAiAnswer } from '../services/ai.js';
import { transcribeAudioFromElement } from '../services/audio.js';
import { QuizInterceptor } from '../services/quiz-interceptor.js';
import type { AppConfig, CLIOptions } from '../types.js';
import type { Activity } from './Activity.js';
import type { Logger } from '../utils/logger.js';

const S = SELECTORS;

export class ActivitySolving {
  private retakeCount = 0;
  private readonly insertableAudioContext: string[] = [];

  constructor(
    private readonly logger: Logger,
    private readonly page: Page,
    private readonly activity: Activity,
    private readonly config: AppConfig,
    private readonly interceptor: QuizInterceptor,
    private readonly useApi: boolean = true,
  ) {}

  async resolveQuiz(): Promise<number> {
    this.logger.info('Resolving the quiz...');
    for (const q of this.activity.questions) q.cacheUsed = false;
    // Always reset — new activity clears answers, retake also clears because
    // loadActivityPageAndTab triggers a new API response that rebuilds the list
    this.interceptor.resetForNewActivity();

    const ready = await this.initQuiz();
    if (ready === 'already_done') return this.activity.questions.length;
    if (ready === 'no_quiz') return 0;

    const questionCount = await this.runQuizLoop();
    return this.finalizeScore(questionCount);
  }

  private async initQuiz(): Promise<'ready' | 'already_done' | 'no_quiz'> {
    await this.loadActivityPageAndTab();

    if (!await this.waitForQuizContainer()) {
      await this.dumpDebugHtml('debug_no_quiz_container.html');
      this.logger.error('Quiz container not found.');
      return 'no_quiz';
    }

    try {
      const start = this.page.locator(S.QUIZ.START);
      await start.first().waitFor({ state: 'visible', timeout: 5_000 });
      await start.first().click({ force: true });
      this.logger.debug('Clicked start/resume');
      await this.waitForQuizContent();
    } catch {
      this.logger.debug('No start button, quiz may already be in progress');
    }

    const allCachedUsed = this.activity.questions.length > 0
      && this.activity.questions.every(q => q.cacheUsed || q.skipCompletion);
    if (allCachedUsed) {
      this.logger.warn('All cached answers used, skipping to avoid loop');
      return 'already_done';
    }
    return 'ready';
  }

  private async runQuizLoop(): Promise<number> {
    let questionCount = 0;
    let errors = 0;

    for (let iter = 0; iter < 100; iter++) {
      if (await this.isFinished()) break;

      const pageType = await this.detectPageType();

      if (pageType === 'insertable') {
        await this.handleInsertablePage();
        errors = 0;
      } else if (pageType === 'question') {
        const ok = await this.handleQuestionSafe();
        if (ok) { questionCount++; errors = 0; }
        else if (++errors >= 3) { this.logger.error('Too many errors, aborting'); break; }
        await this.clickNext();
      } else if (await this.tryClickNext()) {
        errors = 0;
      } else {
        if (++errors >= 3) { await this.dumpDebugHtml('debug_stuck.html'); break; }
        await this.page.waitForLoadState('networkidle').catch(() => {});
      }
    }
    return questionCount;
  }

  private async handleQuestionSafe(): Promise<boolean> {
    try {
      await this.handleQuestion();
      return true;
    } catch (e) {
      this.logger.error(`Question error: ${e}`);
      await this.dumpDebugHtml('debug_question_error.html');
      return false;
    }
  }

  private async finalizeScore(questionCount: number): Promise<number> {
    let score = await this.getScore();
    if (score !== null) {
      this.logger.info(`Quiz finished with score: ${score}%`);
      if (score < 80) {
        await this.retakeIfNeeded(80);
        score = await this.getScore();
      }
    }
    if (score !== null && score < 80) {
      this.logger.warn(`Final score ${score}% below 80%, not counted`);
      return 0;
    }
    return questionCount;
  }

  private async waitForQuizContent(): Promise<void> {
    await Promise.race([
      this.page.locator(S.QUIZ.QUESTION).waitFor({ state: 'visible', timeout: 5_000 }),
      this.page.locator(S.QUIZ.INSERTABLE_PAGE).waitFor({ state: 'visible', timeout: 5_000 }),
      this.page.locator(S.QUIZ.END_PAGE).waitFor({ state: 'visible', timeout: 5_000 }),
    ]).catch(() => {});
  }

  /**
   * Detect what type of page is currently displayed in the quiz.
   */
  private async detectPageType(): Promise<'question' | 'insertable' | 'unknown'> {
    // Check for actual question
    const question = this.page.locator(S.QUIZ.QUESTION);
    if (await question.isVisible({ timeout: 1_000 }).catch(() => false)) {
      return 'question';
    }

    // Check for insertable/info page
    const insertable = this.page.locator(S.QUIZ.INSERTABLE_PAGE);
    if (await insertable.isVisible({ timeout: 1_000 }).catch(() => false)) {
      return 'insertable';
    }

    // Wait a bit longer for either to appear
    try {
      await Promise.race([
        question.waitFor({ state: 'visible', timeout: 5_000 }),
        insertable.waitFor({ state: 'visible', timeout: 5_000 }),
      ]);
    } catch {
      return 'unknown';
    }

    if (await question.isVisible().catch(() => false)) return 'question';
    if (await insertable.isVisible().catch(() => false)) return 'insertable';
    return 'unknown';
  }

  /**
   * Handle an insertable page (informational page with audio/text).
   * Capture audio transcription and text as context, then advance.
   */
  private async handleInsertablePage(): Promise<void> {
    const insertable = this.page.locator(S.QUIZ.INSERTABLE_PAGE);
    this.logger.info('Insertable page detected — capturing context...');

    // Capture text content
    const textContent = (await insertable.textContent())?.trim() ?? '';
    if (textContent) {
      this.insertableAudioContext.push(`[Page content]: ${textContent}`);
      this.logger.debug(`Captured text: ${textContent.slice(0, 100)}...`);
    }

    // Capture audio only in AI mode (API mode doesn't need audio context)
    if (!this.useApi) {
      const audioTranscript = await transcribeAudioFromElement(
        this.page, insertable, this.config, this.logger,
      );
      if (audioTranscript) {
        this.insertableAudioContext.push(`[Audio transcription]: ${audioTranscript}`);
      }
    }

    // Click Next to advance past the insertable page
    await this.clickNext();
  }

  /**
   * Navigate to the activity page and switch to the quiz tab.
   */
  private async loadActivityPageAndTab(): Promise<void> {
    // Always navigate to trigger API response for interceptor
    this.logger.debug(`Navigating to: ${this.activity.url}`);
    await this.page.goto(this.activity.url, { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle').catch(() => {});

    // Session check: if we got redirected to login, session expired
    const nowUrl = this.page.url();
    if (nowUrl.includes('samlconnector') || nowUrl.includes('login.microsoftonline')) {
      throw new Error('SESSION_EXPIRED');
    }

    // Wait for nav tabs
    try {
      await this.page.locator(S.NAV.TABS).waitFor({ timeout: 30_000 });
    } catch {
      this.logger.error(`Nav tabs not found. URL: ${this.page.url()}`);
      throw new Error('Navigation tabs not found');
    }

    // Dismiss modals before clicking tab
    await this.dismissModals();

    // Check quiz tab exists
    const quizTab = this.page.locator(S.NAV.QUIZ_TAB);
    if (await quizTab.count() === 0) {
      throw new Error('NO_QUIZ_TAB');
    }

    try {
      await quizTab.click();
    } catch {
      await quizTab.click({ force: true });
    }

    this.logger.debug('Switched to quiz tab');
    // Wait for quiz content to load instead of fixed timer
    await Promise.race([
      this.page.locator(S.QUIZ.CONTAINER).waitFor({ state: 'visible', timeout: 10_000 }),
      this.page.locator(S.QUIZ.QUIZ_CONTAINER_NEW).waitFor({ state: 'visible', timeout: 10_000 }),
    ]).catch(() => {});
  }

  private async waitForQuizContainer(): Promise<boolean> {
    // Try the #quiz selector first
    try {
      await this.page.locator(S.QUIZ.CONTAINER).waitFor({ timeout: 10_000 });
      return true;
    } catch { /* not found */ }

    // Try the new quiz container class
    try {
      await this.page.locator(S.QUIZ.QUIZ_CONTAINER_NEW).waitFor({ timeout: 5_000 });
      return true;
    } catch { /* not found */ }

    return false;
  }

  private async dismissModals(): Promise<void> {
    try {
      const skipBtn = this.page.locator(S.DASHBOARD.MODAL_SKIP);
      if (await skipBtn.isVisible({ timeout: 1_000 })) {
        await skipBtn.click();
        await skipBtn.waitFor({ state: 'hidden', timeout: 2_000 }).catch(() => {});
      }
    } catch { /* no modal */ }

    try {
      const backdrop = this.page.locator(S.DASHBOARD.MODAL_BACKDROP);
      if (await backdrop.isVisible({ timeout: 1_000 })) {
        await backdrop.click({ force: true });
        await backdrop.waitFor({ state: 'hidden', timeout: 2_000 }).catch(() => {});
      }
    } catch { /* no backdrop */ }
  }

  private async handleQuestion(): Promise<void> {
    const questionContainer = this.page.locator(S.QUIZ.QUESTION);
    await questionContainer.waitFor({ state: 'visible', timeout: 15_000 });

    const question = await Question.fromElement(this.page, questionContainer, this.logger);
    if (!question) {
      const html = await questionContainer.innerHTML().catch(() => 'N/A');
      writeFileSync('debug_unknown_question.html', html, 'utf-8');
      this.logger.error('Unknown question type. Dumped to debug_unknown_question.html');
      throw new Error('Unknown question type');
    }

    this.logger.info(`Question type: ${question.type}`);
    const questionStr = await question.asText();
    this.logger.debug(`Question: ${questionStr.slice(0, 120)}...`);

    // Always consume API index to stay in sync (even for skipped/cached questions)
    const apiAnswer = this.useApi ? this.interceptor.getNextAnswer() : null;

    const cached = this.activity.getQuestion(questionStr);
    let answers: string[];

    if (cached?.correctAnswer && !cached.cacheUsed) {
      this.logger.info(`[CACHE] ${JSON.stringify(cached.correctAnswer).slice(0, 100)}`);
      cached.cacheUsed = true;
      answers = cached.correctAnswer;
    } else if (apiAnswer) {
      this.logger.info(`[API] ${JSON.stringify(apiAnswer).slice(0, 150)}`);
      answers = apiAnswer;
    } else if (question.skipCompletion) {
      answers = ['SKIP'];
    } else {
      // AI fallback
      answers = await this.askAi(questionStr, question.type, questionContainer);
    }

    // Submit and get correct answer
    const correctAnswer = await question.answer(answers);
    this.logger.debug(`Correct answer: ${JSON.stringify(correctAnswer)}`);

    // Cache
    if (cached) {
      cached.correctAnswer = correctAnswer;
    } else {
      this.activity.questions.push({
        questionStr,
        correctAnswer,
        cacheUsed: false,
        firstUse: true,
        skipCompletion: question.skipCompletion,
      });
    }
  }

  private async askAi(questionStr: string, questionType: import('../types.js').QuestionType, container: import('playwright').Locator): Promise<string[]> {
    const extra = this.insertableAudioContext.length > 0 ? this.insertableAudioContext.join('\n') + '\n\n' : '';
    const audio = await transcribeAudioFromElement(this.page, container, this.config, this.logger);
    const prefix = audio ? `[Audio]: ${audio}\n\n` : '';

    this.logger.info('[AI] Waiting for response...');
    const answers = await getAiAnswer(this.config, this.logger, this.activity.asMarkdown(), extra + prefix + questionStr, questionType);
    this.logger.info(`[AI] ${JSON.stringify(answers).slice(0, 150)}`);
    return answers;
  }

  private async clickNext(): Promise<void> {
    const nextButton = this.page.locator(S.QUIZ.NEXT);
    try {
      await nextButton.waitFor({ state: 'visible', timeout: 5_000 });
      await nextButton.click({ force: true });
      // Wait for next button to disappear (= page is transitioning)
      await nextButton.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
    } catch {
      const submitBtn = this.page.locator(S.QUIZ.SUBMIT);
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click({ force: true });
        await submitBtn.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
      }
    }
  }

  private async tryClickNext(): Promise<boolean> {
    for (const sel of [S.QUIZ.NEXT, S.QUIZ.SUBMIT]) {
      const btn = this.page.locator(sel);
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true });
        await btn.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
        return true;
      }
    }
    return false;
  }

  private async isFinished(): Promise<boolean> {
    return (
      await this.page.locator(S.QUIZ.RETAKE).isVisible().catch(() => false) ||
      await this.page.locator(S.QUIZ.END_PAGE).isVisible().catch(() => false)
    );
  }

  private async getScore(): Promise<number | null> {
    const scoreElements = this.page.locator(S.QUIZ.SCORE);
    const count = await scoreElements.count();
    for (let i = 0; i < count; i++) {
      const text = (await scoreElements.nth(i).textContent())?.trim();
      if (text) {
        const match = /(\d+)\s*%/.exec(text);
        if (match && !text.includes('\n')) return Number.parseInt(match[1], 10);
      }
    }
    return null;
  }

  private async retakeIfNeeded(expectedScore: number, maxRetakes = 3): Promise<void> {
    const score = await this.getScore();
    if (score === null || score >= expectedScore) return;

    this.retakeCount++;
    if (this.retakeCount > maxRetakes) {
      this.logger.warn(`Max retakes (${maxRetakes}). Final score: ${score}%`);
      return;
    }

    this.logger.info(`Score ${score}% < ${expectedScore}%, retaking (${this.retakeCount}/${maxRetakes})`);
    try {
      await this.page.locator(S.QUIZ.RETAKE).click();
      // Wait for end page to disappear (quiz is resetting)
      await this.page.locator(S.QUIZ.END_PAGE).waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
      await this.page.locator(S.QUIZ.SCORE).waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
      // Then wait for first quiz content
      await this.waitForQuizContent();
      await this.resolveQuiz();
    } catch (e) {
      this.logger.error(`Retake failed: ${e}`);
    }
  }

  private async dumpDebugHtml(filename: string): Promise<void> {
    try {
      const html = await this.page.content();
      writeFileSync(filename, html, 'utf-8');
      await this.page.screenshot({ path: filename.replace('.html', '.png') }).catch(() => {});
      this.logger.debug(`Debug dumped to ${filename}`);
    } catch { /* ignore */ }
  }
}
