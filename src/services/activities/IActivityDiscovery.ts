import type { ActivityCategory } from '@/types/activity';
import type { CEFRLevel } from '@/types/cefr';
import type { DiscoveredActivity } from '@/types/report';

export interface DiscoverOptions {
  minimumLevel?: CEFRLevel;
  maximumLevel?: CEFRLevel;
  pageSize?: number;
}

export interface IActivityDiscovery {
  discover(
    category: ActivityCategory,
    excludedUuids: Set<string>,
    options: DiscoverOptions,
  ): Promise<DiscoveredActivity[]>;
}
