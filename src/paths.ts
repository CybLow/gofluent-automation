import { join } from 'node:path';

const DATA_DIR = process.env.GOFLUENT_DATA_DIR || join(process.cwd(), 'data');
const LOGS_DIR = process.env.GOFLUENT_LOGS_DIR || join(process.cwd(), 'logs');

export const paths = {
  DATA_DIR,
  LOGS_DIR,
  SESSION_PATH: join(DATA_DIR, 'session.json'),
  URL_CACHE_PATH: join(DATA_DIR, 'cache.txt'),
} as const;
