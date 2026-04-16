function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export const MIN_VALID_SCORE = 80;
export const MONTHLY_TARGET_DEFAULT = envInt('GOFLUENT_MONTHLY_TARGET', 13);

export const BATCH_SIZE = 3;
export const QUIZ_RETRY_ATTEMPTS = 3;
export const DISCOVERY_PAGE_SIZE = 50;
export const MAX_DISCOVERY_PAGES = 200;

export const MAX_HTTP_RETRIES = 3;
export const RETRY_BASE_MS = 300;

export const LOGIN_TIMEOUT_MS = 180_000;
export const TOKEN_CAPTURE_TIMEOUT_MS = 30_000;

export const TRAINING_HISTORY_YEARS = 2;
export const TRAINING_HISTORY_LIMIT = 5000;
