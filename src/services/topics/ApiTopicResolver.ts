import type { IApiClient } from '@/infra/http/IApiClient';
import type { ILogger } from '@/infra/logging/ILogger';
import type { ITopicResolver } from './ITopicResolver';
import { LANGUAGE_ALIASES, normalizeLanguage } from './language-aliases';

interface RawTopic { uuid?: string; id?: string; label?: string; name?: string; title?: string }

const ENDPOINT = '/api/v1/reference-service/topic/?inactive=false&selectable=Profile';

export class ApiTopicResolver implements ITopicResolver {
  constructor(
    private readonly api: IApiClient,
    private readonly logger: ILogger,
  ) {}

  async resolve(language: string): Promise<string> {
    const topics = await this.api.get<RawTopic[]>(ENDPOINT);
    const target = normalizeLanguage(language);
    const aliases = new Set([target, ...(LANGUAGE_ALIASES[target] ?? [])]);

    const match = topics.find(t => this.matches(t, aliases));
    const uuid = match?.uuid ?? match?.id;
    if (!uuid) {
      const available = topics.map(t => t.label ?? t.name).filter(Boolean).slice(0, 10).join(', ');
      throw new Error(`Language "${language}" not found in topics. Available: ${available}`);
    }
    this.logger.debug(`Topic ${language} -> ${uuid}`);
    return uuid;
  }

  private matches(topic: RawTopic, aliases: Set<string>): boolean {
    const label = normalizeLanguage(topic.label ?? topic.name ?? topic.title ?? '');
    if (!label) return false;
    if (aliases.has(label)) return true;
    for (const a of aliases) if (label.includes(a) || a.includes(label)) return true;
    return false;
  }
}
