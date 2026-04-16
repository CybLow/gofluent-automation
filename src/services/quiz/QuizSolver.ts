import { MIN_VALID_SCORE, QUIZ_RETRY_ATTEMPTS } from '@/constants';
import type { IApiClient } from '@/infra/http/IApiClient';
import type { ILogger } from '@/infra/logging/ILogger';
import type { SolveResult } from '@/types/report';
import type { IQuizSolver } from './IQuizSolver';
import { QuestionScanner, type Question } from './QuestionScanner';
import { QuizDataLoader } from './QuizDataLoader';
import { QuizStateClient } from './QuizStateClient';

interface QuizDataWithId { id?: string }

export class QuizSolver implements IQuizSolver {
  private readonly scanner = new QuestionScanner();
  private readonly loader: QuizDataLoader;
  private readonly stateClient: QuizStateClient;

  constructor(
    api: IApiClient,
    topicUuid: string,
    private readonly logger: ILogger,
  ) {
    this.loader = new QuizDataLoader(api, this.scanner, logger);
    this.stateClient = new QuizStateClient(api, topicUuid, logger);
  }

  async solve(contentUuid: string): Promise<SolveResult> {
    const quizData = await this.loader.load(contentUuid) as QuizDataWithId | null;
    const questions = this.scanner.scan(quizData);

    if (questions.length === 0 || !quizData?.id) {
      return { questionCount: 0, score: null, skipped: true };
    }

    this.logger.debug(`Solving quiz: ${questions.length} questions`);
    const score = await this.attemptUntilPass(quizData.id, questions, contentUuid);
    return { questionCount: questions.length, score, skipped: false };
  }

  private async attemptUntilPass(
    quizId: string,
    questions: Question[],
    contentUuid: string,
  ): Promise<number | null> {
    await this.stateClient.runAttempt(quizId, questions, contentUuid, true);
    let score = await this.stateClient.getFinalScore(quizId);
    let attempt = 1;
    while ((score === null || score < MIN_VALID_SCORE) && attempt < QUIZ_RETRY_ATTEMPTS + 1) {
      this.logger.debug(`Score ${score ?? 'unknown'}% < ${MIN_VALID_SCORE}%, retaking (${attempt}/${QUIZ_RETRY_ATTEMPTS})`);
      await this.stateClient.runAttempt(quizId, questions, contentUuid, true);
      score = await this.stateClient.getFinalScore(quizId);
      attempt++;
    }
    return score;
  }
}
