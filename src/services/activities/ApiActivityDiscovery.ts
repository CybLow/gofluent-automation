import { DISCOVERY_PAGE_SIZE, MAX_DISCOVERY_PAGES } from '@/constants';
import type { IApiClient } from '@/infra/http/IApiClient';
import type { ILogger } from '@/infra/logging/ILogger';
import { ALL_CEFR, CEFR_ORDER, type CEFRLevel } from '@/types/cefr';
import { CATEGORY_TARGET_TYPE, type ActivityCategory } from '@/types/activity';
import type { DiscoveredActivity } from '@/types/report';
import type { DiscoverOptions, IActivityDiscovery } from './IActivityDiscovery';

const ENDPOINT = '/api/v1/content-service/content/search';

interface RawItem {
  contentUuid?: string;
  contentUUID?: string;
  id?: string;
  uuid?: string;
  title?: string;
  resourceTitle?: string;
  proficiencies?: string[];
  cefrLevels?: string[];
}

function allowedLevels(opts: DiscoverOptions): number[] {
  if (!opts.minimumLevel && !opts.maximumLevel) return [];
  const min = opts.minimumLevel ? CEFR_ORDER[opts.minimumLevel] : 1;
  const max = opts.maximumLevel ? CEFR_ORDER[opts.maximumLevel] : 6;
  return ALL_CEFR
    .filter((l: CEFRLevel) => CEFR_ORDER[l] >= min && CEFR_ORDER[l] <= max)
    .map((l: CEFRLevel) => CEFR_ORDER[l]);
}

function extractItems(data: unknown): RawItem[] {
  if (Array.isArray(data)) return data as RawItem[];
  const obj = data as Record<string, unknown> | null | undefined;
  for (const key of ['content', 'items', 'results']) {
    const v = obj?.[key];
    if (Array.isArray(v)) return v as RawItem[];
  }
  if (obj && typeof obj === 'object') {
    const fallback = Object.values(obj).find(v => Array.isArray(v));
    if (Array.isArray(fallback)) return fallback as RawItem[];
  }
  return [];
}

function toDiscovered(raw: RawItem): DiscoveredActivity | null {
  const contentUuid = (raw.contentUuid ?? raw.contentUUID ?? raw.id ?? raw.uuid ?? '').toLowerCase();
  if (!contentUuid) return null;
  return {
    contentUuid,
    title: raw.title ?? raw.resourceTitle ?? '',
    proficiencies: raw.proficiencies ?? raw.cefrLevels ?? [],
  };
}

export class ApiActivityDiscovery implements IActivityDiscovery {
  constructor(
    private readonly api: IApiClient,
    private readonly topicUuid: string,
    private readonly logger: ILogger,
  ) {}

  async discover(
    category: ActivityCategory,
    excludedUuids: Set<string>,
    options: DiscoverOptions,
  ): Promise<DiscoveredActivity[]> {
    const pageSize = options.pageSize ?? DISCOVERY_PAGE_SIZE;
    const results: DiscoveredActivity[] = [];
    let totalRaw = 0;

    for (let page = 0; page < MAX_DISCOVERY_PAGES; page++) {
      const items = await this.fetchPage(category, options, page, pageSize);
      if (items.length === 0) break;
      totalRaw += items.length;

      for (const raw of items) {
        const d = toDiscovered(raw);
        if (d && !excludedUuids.has(d.contentUuid)) results.push(d);
      }
      if (items.length < pageSize) break;
    }

    this.logger.debug(`Discovered ${results.length}/${totalRaw} fresh ${category} activities`);
    return results;
  }

  private async fetchPage(
    category: ActivityCategory,
    options: DiscoverOptions,
    page: number,
    pageSize: number,
  ): Promise<RawItem[]> {
    const body = {
      pageNumber: page,
      pageSize,
      keywords: '',
      targetTypes: [CATEGORY_TARGET_TYPE[category]],
      topicUuids: [this.topicUuid],
      sortBy: 'APPROVED_DATE',
      groupingExcluded: [],
      proficiencies: allowedLevels(options),
      tagConcepts: [],
      organizationIds: [],
    };
    const data = await this.api.post<unknown>(ENDPOINT, body);
    return extractItems(data);
  }
}
