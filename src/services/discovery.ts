import type { ApiClient } from '../api.js';
import type { Logger } from '../logger.js';
import {
  ALL_CEFR, CATEGORY_TARGET_TYPE, CEFR_ORDER,
  type ActivityCategory, type CEFRLevel,
} from '../types.js';

export interface DiscoveredActivity {
  contentUuid: string;
  title: string;
  proficiencies: string[];
}

export interface DiscoverOptions {
  minimumLevel?: CEFRLevel;
  maximumLevel?: CEFRLevel;
  pageSize?: number;
}

function allowedLevels(opts: DiscoverOptions): number[] {
  if (!opts.minimumLevel && !opts.maximumLevel) return [];
  const min = opts.minimumLevel ? CEFR_ORDER[opts.minimumLevel] : 1;
  const max = opts.maximumLevel ? CEFR_ORDER[opts.maximumLevel] : 6;
  return ALL_CEFR.filter(l => CEFR_ORDER[l] >= min && CEFR_ORDER[l] <= max).map(l => CEFR_ORDER[l]);
}

function extractItems(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  if (data && typeof data === 'object') {
    const candidate = Object.values(data).find(v => Array.isArray(v));
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function toDiscovered(raw: any): DiscoveredActivity | null {
  const contentUuid = (raw?.contentUuid ?? raw?.contentUUID ?? raw?.id ?? raw?.uuid ?? '').toLowerCase();
  if (!contentUuid) return null;
  return {
    contentUuid,
    title: raw?.title ?? raw?.resourceTitle ?? '',
    proficiencies: raw?.proficiencies ?? raw?.cefrLevels ?? [],
  };
}

export async function discoverActivities(
  api: ApiClient,
  category: ActivityCategory,
  topicUuid: string,
  excludedUuids: Set<string>,
  options: DiscoverOptions,
  logger: Logger,
): Promise<DiscoveredActivity[]> {
  const targetType = CATEGORY_TARGET_TYPE[category];
  const proficiencies = allowedLevels(options);
  const pageSize = options.pageSize ?? 50;

  const results: DiscoveredActivity[] = [];
  let totalRaw = 0;
  const maxPages = 200; // hard safety cap
  for (let page = 0; page < maxPages; page++) {
    const body = {
      pageNumber: page,
      pageSize,
      keywords: '',
      targetTypes: [targetType],
      topicUuids: [topicUuid],
      sortBy: 'APPROVED_DATE',
      groupingExcluded: [],
      proficiencies,
      tagConcepts: [],
      organizationIds: [],
    };
    const data = await api.post('/api/v1/content-service/content/search', body);
    const items = extractItems(data);
    if (items.length === 0) break;
    totalRaw += items.length;

    for (const raw of items) {
      const d = toDiscovered(raw);
      if (!d) continue;
      if (excludedUuids.has(d.contentUuid.toLowerCase())) continue;
      results.push(d);
    }
    if (items.length < pageSize) break;
  }

  logger.debug(`Discovered ${results.length}/${totalRaw} fresh ${category} activities`);
  return results;
}
