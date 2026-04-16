import type { IApiClient } from '@/infra/http/IApiClient';
import type { ILogger } from '@/infra/logging/ILogger';
import { QuestionScanner } from './QuestionScanner';

const QUIZ_REF_KEYS = [
  ['quizUuid'], ['quizId'],
  ['template', 'quizId'], ['template', 'quizUuid'],
  ['quiz', 'id'], ['quiz', 'uuid'],
  ['content', 'quizId'], ['content', 'quizUuid'],
  ['legacy', 'quizId'], ['legacy', 'quizUuid'],
] as const;

const UUID_STRING_RE = /^[0-9a-f-]{36}$/i;

function pickString(obj: unknown, ...path: string[]): string | undefined {
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === 'string' && cur.length > 0 ? cur : undefined;
}

function walkForQuizUuid(obj: unknown, seen: Set<unknown> = new Set()): string | undefined {
  if (!obj || typeof obj !== 'object' || seen.has(obj)) return undefined;
  seen.add(obj);
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && UUID_STRING_RE.test(v) && /quiz/i.test(k)) return v;
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') {
      const r = walkForQuizUuid(v, seen);
      if (r) return r;
    }
  }
  return undefined;
}

export function findQuizRef(content: unknown): string | undefined {
  for (const path of QUIZ_REF_KEYS) {
    const found = pickString(content, ...path);
    if (found) return found;
  }
  return walkForQuizUuid(content);
}

export class QuizDataLoader {
  constructor(
    private readonly api: IApiClient,
    private readonly scanner: QuestionScanner,
    private readonly logger: ILogger,
  ) {}

  async load(contentUuid: string): Promise<unknown> {
    const content = await this.api.get<unknown>(`/api/v1/content-service/content/${contentUuid}`);
    const quizRef = findQuizRef(content);
    this.logger.debug(`quizRef: ${quizRef ?? '(none)'}`);

    if (quizRef) {
      const fromRef = await this.tryFetchQuiz(quizRef);
      if (fromRef) return fromRef;
    }
    const fromContent = await this.tryFetchQuiz(contentUuid);
    return fromContent ?? content;
  }

  private async tryFetchQuiz(ref: string): Promise<unknown> {
    try {
      const q = await this.api.get<unknown>(`/api/v1/content-service/quiz/legacy/${ref}`);
      return this.scanner.has(q) ? q : null;
    } catch (e) {
      this.logger.debug(`quiz/legacy/${ref} failed: ${e}`);
      return null;
    }
  }
}
