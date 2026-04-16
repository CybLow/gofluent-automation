import type { ActivityInfo } from '@/types/activity';
import { ActivityDateParser } from './ActivityDateParser';

export interface RawApiActivity {
  index?: number;
  title?: string;
  type?: string;
  language?: string;
  completionDate?: string;
  score?: string;
  contentUuid?: string;
}

function parseScorePercent(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = /(\d+)\s*%/.exec(raw);
  return m ? Number.parseInt(m[1], 10) : null;
}

export class ActivityMapper {
  constructor(
    private readonly siteBase: string,
    private readonly dateParser: ActivityDateParser = new ActivityDateParser(),
  ) {}

  map(raw: RawApiActivity): ActivityInfo | null {
    const contentUuid = (raw.contentUuid ?? '').toLowerCase();
    if (!contentUuid) return null;
    const date = this.dateParser.parse(raw.completionDate ?? '');
    if (Number.isNaN(date.getTime())) return null;
    return {
      contentUuid,
      url: `${this.siteBase}/app/dashboard/learning/${contentUuid}`,
      date,
      score: parseScorePercent(raw.score),
      title: raw.title ?? '',
      contentType: (raw.type ?? 'Activity').toLowerCase(),
    };
  }
}
