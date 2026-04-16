import type { ApiClient } from '../api.js';
import type { Logger } from '../logger.js';

const LANGUAGE_ALIASES: Record<string, string[]> = {
  anglais: ['english', 'anglais'],
  english: ['english', 'anglais'],
  espagnol: ['spanish', 'espagnol', 'espanol'],
  spanish: ['spanish', 'espagnol', 'espanol'],
  allemand: ['german', 'allemand', 'deutsch'],
  german: ['german', 'allemand', 'deutsch'],
  italien: ['italian', 'italien', 'italiano'],
  italian: ['italian', 'italien', 'italiano'],
  francais: ['french', 'francais'],
  french: ['french', 'francais'],
  portugais: ['portuguese', 'portugais'],
  portuguese: ['portuguese', 'portugais'],
};

function normalize(s: string): string {
  return s.normalize('NFD').replaceAll(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export async function resolveTopicUuid(api: ApiClient, language: string, logger: Logger): Promise<string> {
  const topics: any[] = await api.get('/api/v1/reference-service/topic/?inactive=false&selectable=Profile');
  const target = normalize(language);
  const aliases = new Set([target, ...(LANGUAGE_ALIASES[target] ?? [])]);

  const match = topics.find((t: any) => {
    const label = normalize(t.label ?? t.name ?? t.title ?? '');
    if (!label) return false;
    if (aliases.has(label)) return true;
    for (const a of aliases) if (label.includes(a) || a.includes(label)) return true;
    return false;
  });

  const uuid = match?.uuid ?? match?.id;
  if (!uuid) {
    const labels = topics.map((t: any) => t.label ?? t.name).filter(Boolean).slice(0, 10).join(', ');
    throw new Error(`Language "${language}" not found in topics. Available: ${labels}`);
  }
  logger.debug(`Topic ${language} -> ${uuid}`);
  return uuid;
}
