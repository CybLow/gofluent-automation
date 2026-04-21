import { join } from 'node:path';

const DATA_DIR = process.env.GOFLUENT_DATA_DIR || join(process.cwd(), 'data');
const LOGS_DIR = process.env.GOFLUENT_LOGS_DIR || join(process.cwd(), 'logs');

function slug(profile?: string): string {
  return profile ? `-${profile.toLowerCase()}` : '';
}

export const paths = {
  DATA_DIR,
  LOGS_DIR,
  SESSION_PATH: join(DATA_DIR, 'session.json'),
  URL_CACHE_PATH: join(DATA_DIR, 'cache.txt'),
  sessionPath: (profile?: string): string => join(DATA_DIR, `session${slug(profile)}.json`),
  urlCachePath: (profile?: string): string => join(DATA_DIR, `cache${slug(profile)}.txt`),
} as const;
