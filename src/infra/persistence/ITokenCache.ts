import type { BrowserContext } from 'playwright';

export type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

export interface SessionEntry {
  token: string;
  userId: string;
  exp: number;
  storageState?: StorageState;
}

export interface ITokenCache {
  load(): SessionEntry | null;
  loadStorageState(): StorageState | null;
  save(entry: SessionEntry): void;
  clear(): void;
  path: string;
}
