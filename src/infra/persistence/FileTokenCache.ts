import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ILogger } from '@/infra/logging/ILogger';
import type { ITokenCache, SessionEntry, StorageState } from './ITokenCache';

const MIN_REMAINING_SECONDS = 60;

export class FileTokenCache implements ITokenCache {
  constructor(
    public readonly path: string,
    private readonly logger: ILogger,
  ) {}

  load(): SessionEntry | null {
    const entry = this.readRaw();
    if (!entry) return null;
    const remaining = entry.exp - Math.floor(Date.now() / 1000);
    if (remaining > MIN_REMAINING_SECONDS) {
      this.logger.debug(`Cached token valid for ${Math.floor(remaining / 60)}min`);
      return entry;
    }
    return null;
  }

  loadStorageState(): StorageState | null {
    return this.readRaw()?.storageState ?? null;
  }

  save(entry: SessionEntry): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(entry), 'utf-8');
  }

  clear(): void {
    if (existsSync(this.path)) unlinkSync(this.path);
  }

  private readRaw(): SessionEntry | null {
    if (!existsSync(this.path)) return null;
    try {
      return JSON.parse(readFileSync(this.path, 'utf-8')) as SessionEntry;
    } catch (e) {
      this.logger.debug(`Session read failed: ${e}`);
      return null;
    }
  }
}
