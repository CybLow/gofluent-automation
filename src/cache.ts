import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const CACHE_PATH = 'data/cache.txt';

export function getCachedUrls(): Set<string> {
  if (!existsSync(CACHE_PATH)) return new Set();
  const content = readFileSync(CACHE_PATH, 'utf-8');
  return new Set(content.split('\n').map(l => l.trim()).filter(Boolean));
}

export function addToCache(urls: string[]): void {
  const existing = getCachedUrls();
  for (const u of urls) existing.add(u);
  writeFileSync(CACHE_PATH, [...existing].join('\n') + '\n', 'utf-8');
}
