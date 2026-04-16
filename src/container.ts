import { AuthService } from '@/auth/AuthService';
import { EnvAppConfig } from '@/config/EnvAppConfig';
import { PlaywrightLauncher } from '@/infra/browser/PlaywrightLauncher';
import { FetchApiClient } from '@/infra/http/FetchApiClient';
import { Logger } from '@/infra/logging/Logger';
import { FileTokenCache } from '@/infra/persistence/FileTokenCache';
import { FileUrlCacheRepo } from '@/infra/persistence/FileUrlCacheRepo';
import { paths } from '@/paths';
import { ReportFormatter } from '@/reporting/ReportFormatter';
import { AutoRunner } from '@/runners/AutoRunner';
import type { IRunner } from '@/runners/IRunner';
import { ReportRunner } from '@/runners/ReportRunner';
import { SimpleRunner } from '@/runners/SimpleRunner';
import { ApiActivityDiscovery } from '@/services/activities/ApiActivityDiscovery';
import { QuizSolver } from '@/services/quiz/QuizSolver';
import { ApiTopicResolver } from '@/services/topics/ApiTopicResolver';
import { ApiTrainingReportService } from '@/services/training/ApiTrainingReportService';
import type { ILogger } from '@/infra/logging/ILogger';
import type { ParsedCli } from '@/types/options';

export interface Bootstrapped {
  runner: IRunner;
  logger: ILogger;
}

export async function buildContainer(parsed: ParsedCli): Promise<Bootstrapped> {
  const logger: ILogger = new Logger(paths.LOGS_DIR, parsed.common.debug);
  const config = new EnvAppConfig(parsed.common.profile);

  const tokenCache = new FileTokenCache(paths.SESSION_PATH, logger);
  const browserLauncher = new PlaywrightLauncher(logger);
  const authService = new AuthService(config, tokenCache, browserLauncher, logger);
  const { token, userId } = await authService.authenticate();

  const api = new FetchApiClient(config.siteBase(), token, tokenCache, logger);
  const topicResolver = new ApiTopicResolver(api, logger);
  const topicUuid = await topicResolver.resolve(parsed.common.language);

  const runner = buildRunner(parsed, api, userId, topicUuid, config.siteBase(), logger);
  return { runner, logger };
}

function buildRunner(
  parsed: ParsedCli,
  api: FetchApiClient,
  userId: string,
  topicUuid: string,
  siteBase: string,
  logger: ILogger,
): IRunner {
  const training = new ApiTrainingReportService(api, userId, logger);

  if (parsed.mode === 'report') {
    return new ReportRunner(training, new ReportFormatter(), logger);
  }
  const questionDelayMs = parsed.common.questionDelayMs;

  if (parsed.mode === 'simple' && parsed.simple) {
    const quiz = new QuizSolver(api, topicUuid, logger, questionDelayMs);
    return new SimpleRunner(quiz, logger, parsed.simple);
  }
  if (!parsed.auto) throw new Error('Missing auto-run options');
  const urlCache = new FileUrlCacheRepo(paths.URL_CACHE_PATH);
  const discovery = new ApiActivityDiscovery(api, topicUuid, logger);
  const quiz = new QuizSolver(api, topicUuid, logger, questionDelayMs);
  return new AutoRunner(training, discovery, quiz, urlCache, siteBase, logger, parsed.auto);
}
