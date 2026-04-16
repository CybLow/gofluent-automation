import type { ApiClient } from '../api.js';
import type { Logger } from '../logger.js';
import type { ActivityInfo, TrainingReport } from '../types.js';

interface ApiActivity {
  index?: number;
  title?: string;
  type?: string;          // "Activity" | "Test" | ...
  language?: string;
  completionDate?: string; // "16 Apr 2026, 06:04:25 PM"
  score?: string;          // "100%" or "A1.1 [CEFR Pre-A1]"
  contentUuid?: string;
}

const EN_MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseCompletionDate(text: string): Date {
  if (!text) return new Date(NaN);
  const clean = text.trim();
  const m = /^(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i.exec(clean);
  if (m) {
    const day = Number.parseInt(m[1], 10);
    const month = EN_MONTHS[m[2].toLowerCase()];
    const year = Number.parseInt(m[3], 10);
    let hours = Number.parseInt(m[4], 10);
    const minutes = Number.parseInt(m[5], 10);
    const seconds = Number.parseInt(m[6], 10);
    const ampm = m[7]?.toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    if (month !== undefined) return new Date(year, month, day, hours, minutes, seconds);
  }
  const d = new Date(clean);
  return d;
}

function parseScore(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = /(\d+)\s*%/.exec(raw);
  return m ? Number.parseInt(m[1], 10) : null;
}

function isCurrentMonthAndYear(d: Date): boolean {
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function toActivityInfo(base: string, a: ApiActivity): ActivityInfo | null {
  const contentUuid = (a.contentUuid ?? '').toLowerCase();
  if (!contentUuid) return null;
  const date = parseCompletionDate(a.completionDate ?? '');
  if (Number.isNaN(date.getTime())) return null;

  return {
    contentUuid,
    url: `${base}/app/dashboard/learning/${contentUuid}`,
    date,
    score: parseScore(a.score),
    title: a.title ?? '',
    contentType: (a.type ?? 'Activity').toLowerCase(),
  };
}

export async function fetchTrainingReport(
  api: ApiClient,
  userId: string,
  _topicUuid: string,
  logger: Logger,
): Promise<TrainingReport> {
  logger.step('Fetching training history…');

  // Default 2-year window — covers all data that the training page shows
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now); fromDate.setFullYear(fromDate.getFullYear() - 2);
  const from = fromDate.toISOString().slice(0, 10);

  const url = `/api/v1/report/learner/${userId}/activities?startDate=${from}&endDate=${to}&reportType=json&limit=5000`;
  const resp: any = await api.get(url);
  const raw: ApiActivity[] = Array.isArray(resp)
    ? resp
    : (resp?.content ?? resp?.activities ?? resp?.items ?? []);

  // Only include "Activity" rows (skip placement tests, etc.) for scoring metrics
  const activities = raw
    .filter(a => (a.type ?? 'Activity') === 'Activity')
    .map(a => toActivityInfo(api.base, a))
    .filter((a): a is ActivityInfo => a !== null);

  const monthlyRaw = activities.filter(a => isCurrentMonthAndYear(a.date));

  // Dedup current month by contentUuid, keeping the BEST score
  const bestByUuid = new Map<string, ActivityInfo>();
  for (const a of monthlyRaw) {
    const existing = bestByUuid.get(a.contentUuid);
    if (!existing || (a.score ?? 0) > (existing.score ?? 0)) bestByUuid.set(a.contentUuid, a);
  }
  const dedupedMonthly = [...bestByUuid.values()];

  const monthlyValid = dedupedMonthly.filter(a => a.score !== null && a.score >= 80);
  const monthlyFailed = dedupedMonthly.filter(a => a.score !== null && a.score < 80);

  logger.success(
    `${activities.length} attempts loaded · this month: ${dedupedMonthly.length} unique ` +
    `(${monthlyValid.length} ≥80%, ${monthlyFailed.length} <80%)`
  );

  return { all: activities, monthly: dedupedMonthly, monthlyValid, monthlyFailed };
}
