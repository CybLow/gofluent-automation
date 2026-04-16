import type { IApiClient } from '@/infra/http/IApiClient';
import type { ILogger } from '@/infra/logging/ILogger';
import type { Question } from './QuestionScanner';

const GEO = 'EU';

export class QuizStateClient {
  constructor(
    private readonly api: IApiClient,
    private readonly topicUuid: string,
    private readonly logger: ILogger,
  ) {}

  async runAttempt(
    quizId: string,
    questions: Question[],
    contentUuid: string,
    forceStartNew: boolean,
  ): Promise<void> {
    const stateId = await this.createState(quizId, questions, contentUuid, forceStartNew);
    this.logger.debug(`stateId ${stateId}`);
    for (let i = 0; i < questions.length; i++) {
      await this.submitAnswer(stateId, i + 1, questions[i]);
    }
  }

  async getFinalScore(quizId: string): Promise<number | null> {
    try {
      const state = await this.api.get<Record<string, unknown>>(
        `/api/v1/quiz-state/quiz/state/quiz/${quizId}`,
      );
      return computePercent(state);
    } catch (e) {
      this.logger.debug(`getFinalScore failed: ${e}`);
      return null;
    }
  }

  private async createState(
    quizId: string,
    questions: Question[],
    contentUuid: string,
    forceStartNew: boolean,
  ): Promise<string> {
    const concepts = collectTeachingConcepts(questions);
    const resp = await this.api.postRaw('/api/v1/quiz-state/quiz/', {
      quizUuid: quizId,
      contentUuid,
      topicUuid: this.topicUuid,
      geo: GEO,
      teachingConcepts: [...concepts],
      maxScore: questions.length,
      questionCnt: questions.length,
      forceStartNew,
      scoringTypes: null,
    });
    return (await resp.text()).replace(/"/g, '').trim();
  }

  private async submitAnswer(stateId: string, sequence: number, q: Question): Promise<void> {
    const solutions = q.solutions ?? q.receivers?.flatMap(r => r.solutions ?? []) ?? [];
    await this.api.postRaw(`/api/v1/quiz-state/quiz/state/${stateId}/answer`, {
      quizStateUuid: stateId,
      sequence,
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

function collectTeachingConcepts(questions: Question[]): Set<string> {
  const concepts = new Set<string>();
  for (const q of questions) {
    for (const tc of q.metadata?.teachingConcepts ?? []) concepts.add(tc);
  }
  return concepts;
}

function computePercent(state: Record<string, unknown>): number | null {
  const finalScore = state.finalScore;
  const maxScore = state.maxScore ?? state.questionCnt ?? state.questionsNumber;
  if (typeof finalScore === 'number' && typeof maxScore === 'number' && maxScore > 0) {
    return Math.round((finalScore / maxScore) * 100);
  }
  const percentage = state.percentage ?? state.scorePercentage;
  if (typeof percentage === 'number') return percentage <= 1 ? Math.round(percentage * 100) : percentage;
  return null;
}
