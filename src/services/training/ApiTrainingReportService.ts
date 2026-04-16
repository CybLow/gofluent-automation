import { MIN_VALID_SCORE, TRAINING_HISTORY_LIMIT, TRAINING_HISTORY_YEARS } from '@/constants';
import type { IApiClient } from '@/infra/http/IApiClient';
import type { ILogger } from '@/infra/logging/ILogger';
import type { ActivityInfo } from '@/types/activity';
import type { TrainingReport } from '@/types/report';
import { ActivityMapper, type RawApiActivity } from './ActivityMapper';
import type { ITrainingReportService } from './ITrainingReportService';

function isCurrentMonth(d: Date): boolean {
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function dedupeByBestScore(activities: ActivityInfo[]): ActivityInfo[] {
  const bestByUuid = new Map<string, ActivityInfo>();
  for (const a of activities) {
    const existing = bestByUuid.get(a.contentUuid);
    if (!existing || (a.score ?? 0) > (existing.score ?? 0)) bestByUuid.set(a.contentUuid, a);
  }
  return [...bestByUuid.values()];
}

function historyWindow(): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setFullYear(fromDate.getFullYear() - TRAINING_HISTORY_YEARS);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

export class ApiTrainingReportService implements ITrainingReportService {
  private readonly mapper: ActivityMapper;

  constructor(
    private readonly api: IApiClient,
    private readonly userId: string,
    private readonly logger: ILogger,
  ) {
    this.mapper = new ActivityMapper(api.base);
  }

  async fetch(): Promise<TrainingReport> {
    this.logger.step('Fetching training history…');
    const raw = await this.fetchRaw();

    const activities = raw
      .filter(a => (a.type ?? 'Activity') === 'Activity')
      .map(a => this.mapper.map(a))
      .filter((a): a is ActivityInfo => a !== null);

    const monthly = dedupeByBestScore(activities.filter(a => isCurrentMonth(a.date)));
    const monthlyValid = monthly.filter(a => a.score !== null && a.score >= MIN_VALID_SCORE);
    const monthlyFailed = monthly.filter(a => a.score !== null && a.score < MIN_VALID_SCORE);

    this.logger.success(
      `${activities.length} attempts loaded · this month: ${monthly.length} unique ` +
      `(${monthlyValid.length} ≥${MIN_VALID_SCORE}%, ${monthlyFailed.length} <${MIN_VALID_SCORE}%)`
    );

    return { all: activities, monthly, monthlyValid, monthlyFailed };
  }

  private async fetchRaw(): Promise<RawApiActivity[]> {
    const { from, to } = historyWindow();
    const url = `/api/v1/report/learner/${this.userId}/activities`
      + `?startDate=${from}&endDate=${to}&reportType=json&limit=${TRAINING_HISTORY_LIMIT}`;
    const resp = await this.api.get<unknown>(url);
    if (Array.isArray(resp)) return resp as RawApiActivity[];
    const obj = resp as { content?: unknown; activities?: unknown; items?: unknown } | null;
    const candidate = obj?.content ?? obj?.activities ?? obj?.items;
    return Array.isArray(candidate) ? (candidate as RawApiActivity[]) : [];
  }
}
