import type { ApiClient } from '../api.js';
import type { Logger } from '../logger.js';

interface Question {
  id: string;
  questionType?: string;
  questionSubType?: string;
  solutions?: string[];
  receivers?: { solutions?: string[] }[];
  metadata?: { teachingConcepts?: string[] };
}

function scanQuestions(obj: any, out: Question[]): void {
  if (!obj || typeof obj !== 'object') return;
  if (obj.questionType && obj.id) out.push(obj);
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) v.forEach(item => scanQuestions(item, out));
    else if (typeof v === 'object') scanQuestions(v, out);
  }
}

function findQuizRef(content: any): string | undefined {
  const candidates = [
    content?.quizUuid, content?.quizId,
    content?.template?.quizId, content?.template?.quizUuid,
    content?.quiz?.id, content?.quiz?.uuid,
    content?.content?.quizId, content?.content?.quizUuid,
    content?.legacy?.quizId, content?.legacy?.quizUuid,
  ];
  for (const c of candidates) if (typeof c === 'string' && c) return c;

  const seen = new Set<any>();
  function walk(o: any): string | undefined {
    if (!o || typeof o !== 'object' || seen.has(o)) return undefined;
    seen.add(o);
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) && /quiz/i.test(k)) return v;
    }
    for (const v of Object.values(o)) {
      if (v && typeof v === 'object') {
        const r = walk(v);
        if (r) return r;
      }
    }
    return undefined;
  }
  return walk(content);
}

function hasQuestions(data: any): boolean {
  const probe: Question[] = [];
  scanQuestions(data, probe);
  return probe.length > 0;
}

async function loadQuizData(api: ApiClient, contentUuid: string, logger: Logger): Promise<any> {
  const content: any = await api.get(`/api/v1/content-service/content/${contentUuid}`);
  const quizRef = findQuizRef(content);
  logger.debug(`quizRef: ${quizRef ?? '(none)'}`);

  if (quizRef) {
    try {
      const q = await api.get(`/api/v1/content-service/quiz/legacy/${quizRef}`);
      if (hasQuestions(q)) return q;
    } catch (e) {
      logger.debug(`quiz/legacy/${quizRef} failed: ${e}`);
    }
  }

  try {
    const q = await api.get(`/api/v1/content-service/quiz/legacy/${contentUuid}`);
    if (hasQuestions(q)) return q;
  } catch { /* ignore */ }

  return content;
}

async function getFinalScore(api: ApiClient, quizId: string, logger: Logger): Promise<number | null> {
  try {
    const state: any = await api.get(`/api/v1/quiz-state/quiz/state/quiz/${quizId}`);
    const finalScore = state?.finalScore;
    const maxScore = state?.maxScore ?? state?.questionCnt ?? state?.questionsNumber;
    if (typeof finalScore === 'number' && typeof maxScore === 'number' && maxScore > 0) {
      return Math.round((finalScore / maxScore) * 100);
    }
    const percentage = state?.percentage ?? state?.scorePercentage;
    if (typeof percentage === 'number') return percentage <= 1 ? Math.round(percentage * 100) : percentage;
  } catch (e) {
    logger.debug(`getFinalScore failed: ${e}`);
  }
  return null;
}

async function runQuizAttempt(
  api: ApiClient,
  quizData: any,
  questions: Question[],
  contentUuid: string,
  topicUuid: string,
  forceStartNew: boolean,
  logger: Logger,
): Promise<void> {
  const concepts = new Set<string>();
  for (const q of questions) {
    for (const tc of q.metadata?.teachingConcepts ?? []) concepts.add(tc);
  }

  const createResp = await api.postRaw('/api/v1/quiz-state/quiz/', {
    quizUuid: quizData.id,
    contentUuid,
    topicUuid,
    geo: 'EU',
    teachingConcepts: [...concepts],
    maxScore: questions.length,
    questionCnt: questions.length,
    forceStartNew,
    scoringTypes: null,
  });
  const stateId = (await createResp.text()).replace(/"/g, '').trim();
  logger.debug(`stateId ${stateId}`);

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const solutions = q.solutions ?? q.receivers?.flatMap(r => r.solutions ?? []) ?? [];
    await api.postRaw(`/api/v1/quiz-state/quiz/state/${stateId}/answer`, {
      quizStateUuid: stateId,
      sequence: i + 1,
      questionUuid: q.id,
      groupUuid: '',
      timerUuid: q.id,
      questionTimeMs: 1.5 + Math.random() * 3,
      questionType: q.questionSubType || q.questionType,
      isCorrect: true,
      answers: solutions,
      questionTeachingConcepts: q.metadata?.teachingConcepts ?? [],
      score: 1,
    });
  }
}

export interface SolveResult {
  questionCount: number;
  score: number | null;
  skipped: boolean;
}

export async function solveQuiz(
  api: ApiClient,
  contentUuid: string,
  topicUuid: string,
  logger: Logger,
): Promise<SolveResult> {
  const quizData = await loadQuizData(api, contentUuid, logger);
  const questions: Question[] = [];
  scanQuestions(quizData, questions);

  if (questions.length === 0 || !quizData?.id) {
    return { questionCount: 0, score: null, skipped: true };
  }

  logger.debug(`Solving quiz: ${questions.length} questions`);
  // forceStartNew: true avoids inheriting a corrupted/stuck server-side state from
  // a previous attempt (observed with some quizzes returning 500 on answer POST).
  await runQuizAttempt(api, quizData, questions, contentUuid, topicUuid, true, logger);

  let score = await getFinalScore(api, quizData.id, logger);
  let attempt = 1;
  while ((score === null || score < 80) && attempt < 4) {
    logger.debug(`Score ${score ?? 'unknown'}% < 80%, retaking (${attempt}/3)`);
    await runQuizAttempt(api, quizData, questions, contentUuid, topicUuid, true, logger);
    score = await getFinalScore(api, quizData.id, logger);
    attempt++;
  }
  return { questionCount: questions.length, score, skipped: false };
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function extractUuidFromUrl(url: string): string | null {
  const m = UUID_RE.exec(url);
  return m ? m[0] : null;
}
