import type { Page } from 'playwright';
import type { Logger } from '../utils/logger.js';
import { normalize } from '../utils/strings.js';

interface InterceptedAnswer {
  apiType: string;
  solutions: string[];
}

/**
 * Intercepts GoFluent quiz API responses to extract correct answers.
 * The API sends all solutions in the JSON when the quiz loads.
 * This gives 100% accuracy without AI.
 */
export class QuizInterceptor {
  /** stemText (normalized) → resolved answer strings */
  private readonly answers = new Map<string, InterceptedAnswer>();
  private listening = false;

  constructor(private readonly logger: Logger) {}

  startListening(page: Page): void {
    this.answers.clear();
    if (this.listening) return; // Listener already attached, just cleared answers
    this.listening = true;

    page.on('response', async (response) => {
      const url = response.url();
      const isQuiz = url.includes('content-service/quiz/legacy') || url.includes('content-service/quiz/');
      const isContent = url.includes('content-service/content/') && !url.includes('composing') && !url.includes('search') && !url.includes('categories');

      if (!isQuiz && !isContent) return;

      try {
        const json = await response.text();
        this.parseQuizJson(json);
      } catch { /* response not readable */ }
    });

    this.logger.debug('[API] Interceptor listening for quiz responses');
  }

  getAnswer(stemText: string): string[] | null {
    const key = normalize(stemText);

    // Exact match
    const direct = this.answers.get(key);
    if (direct) return direct.solutions;

    // Substring match (DOM text may include options, extra content)
    for (const [k, v] of this.answers) {
      if (key.includes(k) || k.includes(key)) return v.solutions;
    }

    // Fuzzy: check if the first 40 chars of one match the other
    const keyStart = key.slice(0, 40);
    for (const [k, v] of this.answers) {
      if (k.startsWith(keyStart) || keyStart.startsWith(k.slice(0, 40))) return v.solutions;
    }

    if (this.answers.size > 0) {
      this.logger.debug(`[API] No match for: "${key.slice(0, 60)}"`);
      this.logger.debug(`[API] Available stems: ${[...this.answers.keys()].map(k => k.slice(0, 50)).join(' | ')}`);
    }

    return null;
  }

  get interceptedCount(): number {
    return this.answers.size;
  }

  private parseQuizJson(json: string): void {
    try {
      const data = JSON.parse(json);

      // Build global id→text map
      const idMap = new Map<string, string>();
      this.scanIds(data, idMap);

      // Find all questions and resolve solutions
      const questions: any[] = [];
      this.scanQuestions(data, questions);

      for (const q of questions) {
        this.resolveQuestion(q, idMap);
      }

      this.logger.debug(`[API] Intercepted ${questions.length} questions (${this.answers.size} total mapped)`);
    } catch (e) {
      this.logger.debug(`[API] Failed to parse quiz JSON: ${e}`);
    }
  }

  private scanIds(obj: any, map: Map<string, string>): void {
    if (!obj || typeof obj !== 'object') return;
    if (obj.id && typeof obj.text === 'string') {
      map.set(obj.id, obj.text);
    }
    if (obj.id && typeof obj.label === 'string') {
      map.set(obj.id, obj.label);
    }
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

  private resolveQuestion(q: any, idMap: Map<string, string>): void {
    const apiType = q.questionSubType || q.questionType;

    // Get solution UUIDs
    const solutionIds: string[] = q.solutions
      ?? q.receivers?.flatMap((r: any) => r.solutions ?? [])
      ?? [];

    if (solutionIds.length === 0) return;

    // Resolve UUIDs to text
    const solutions = solutionIds
      .map((id: string) => idMap.get(id))
      .filter((t): t is string => t !== undefined);

    if (solutions.length === 0) return;

    // Extract stem text for matching with DOM question text
    const stemText = this.extractStemText(q);
    if (!stemText) return;

    const key = normalize(stemText);
    this.answers.set(key, { apiType, solutions });
  }

  private extractStemText(q: any): string | null {
    if (q.items) {
      for (const item of q.items) {
        if (item.contentItemType === 'STEM' || item.type === 'STEM') {
          // Stem text is in the 'data' field as HTML
          if (item.data) return this.stripHtml(item.data);
          if (item.text) return this.stripHtml(item.text);
        }
      }
    }
    if (q.description) return this.stripHtml(q.description);
    return null;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
