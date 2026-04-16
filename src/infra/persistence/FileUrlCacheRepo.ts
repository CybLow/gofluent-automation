import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { IUrlCacheRepo } from './IUrlCacheRepo';

export class FileUrlCacheRepo implements IUrlCacheRepo {
  constructor(private readonly filePath: string) {}

  getAll(): Set<string> {
    if (!existsSync(this.filePath)) return new Set();
    const content = readFileSync(this.filePath, 'utf-8');
    return new Set(content.split('\n').map(l => l.trim()).filter(Boolean));
  }

  add(urls: string[]): void {
    if (urls.length === 0) return;
    const existing = this.getAll();
    for (const u of urls) existing.add(u);
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, [...existing].join('\n') + '\n', 'utf-8');
  }
}
