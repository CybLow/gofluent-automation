import type { Page } from 'playwright';
import type { Logger } from '../utils/logger.js';

interface InterceptedAnswer {
  apiType: string;
  solutions: string[];
}

/**
 * Intercepts GoFluent quiz API responses to extract correct answers.
 * Answers are stored by index — question N in the DOM = item N in the JSON.
 * No text matching needed → 100% reliable.
 */
export class QuizInterceptor {
  /** Ordered list of answers — index matches question order in quiz */
  private readonly answersByIndex: InterceptedAnswer[] = [];
  private questionIndex = 0;
  private listening = false;

  constructor(private readonly logger: Logger) {}

  startListening(page: Page): void {
    this.answersByIndex.length = 0;
    this.questionIndex = 0;
    if (this.listening) return;
    this.listening = true;

    page.on('response', async (response) => {
      const url = response.url();
      const isQuiz = url.includes('content-service/quiz/legacy') || url.includes('content-service/quiz/');
      const isContent = url.includes('content-service/content/')
        && !url.includes('composing') && !url.includes('search') && !url.includes('categories');

      if (!isQuiz && !isContent) return;

      try {
        const json = await response.text();
        this.parseQuizJson(json);
      } catch { /* response not readable */ }
    });

    this.logger.debug('[API] Interceptor listening');
  }

  /** Get the next answer in order. Call once per question. */
  getNextAnswer(): string[] | null {
    if (this.questionIndex >= this.answersByIndex.length) return null;
    const answer = this.answersByIndex[this.questionIndex];
    this.questionIndex++;
    this.logger.debug(`[API] Q${this.questionIndex}/${this.answersByIndex.length}: ${answer.apiType}`);
    return answer.solutions;
  }

  /** Reset index for retakes — same questions, same order */
  resetIndex(): void {
    this.questionIndex = 0;
  }

  /** Clear answers for new activity — new quiz will be intercepted */
  resetForNewActivity(): void {
    this.answersByIndex.length = 0;
    this.questionIndex = 0;
  }

  get totalIntercepted(): number {
    return this.answersByIndex.length;
  }

  private parseQuizJson(json: string): void {
    try {
      const data = JSON.parse(json);

      const idMap = new Map<string, string>();
      this.scanIds(data, idMap);

      const questions: any[] = [];
      this.scanQuestions(data, questions);

      for (const q of questions) {
        const resolved = this.resolveQuestion(q, idMap);
        if (resolved) this.answersByIndex.push(resolved);
      }

      this.logger.debug(`[API] Intercepted ${questions.length} questions (${this.answersByIndex.length} resolved)`);
    } catch (e) {
      this.logger.debug(`[API] Parse error: ${e}`);
    }
  }

  private scanIds(obj: any, map: Map<string, string>): void {
    if (!obj || typeof obj !== 'object') return;
    if (obj.id && typeof obj.text === 'string') map.set(obj.id, this.decodeHtml(obj.text));
    if (obj.id && typeof obj.label === 'string') map.set(obj.id, this.decodeHtml(obj.label));
    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) v.forEach(item => this.scanIds(item, map));
      else if (typeof v === 'object') this.scanIds(v, map);
    }
  }

  private scanQuestions(obj: any, out: any[]): void {
    if (!obj || typeof obj !== 'object') return;
    if (obj.questionType) out.push(obj);
    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) v.forEach(item => this.scanQuestions(item, out));
      else if (typeof v === 'object') this.scanQuestions(v, out);
    }
  }

  private resolveQuestion(q: any, idMap: Map<string, string>): InterceptedAnswer | null {
    const apiType = q.questionSubType || q.questionType;

    const solutionIds: string[] = q.solutions
      ?? q.receivers?.flatMap((r: any) => r.solutions ?? [])
      ?? [];

    if (solutionIds.length === 0) return null;

    const solutions = solutionIds
      .map((id: string) => idMap.get(id))
      .filter((t): t is string => t !== undefined);

    if (solutions.length === 0) return null;

    return { apiType, solutions };
  }

  private decodeHtml(text: string): string {
    return text
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'");
  }
}
