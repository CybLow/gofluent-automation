import type { AppConfig } from './types.js';

function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function loadConfig(profile?: string): AppConfig {
  const suffix = profile ? `__${profile.toUpperCase()}` : '';

  return {
    gofluentUsername: env(`GOFLUENT_USERNAME${suffix}`),
    gofluentPassword: env(`GOFLUENT_PASSWORD${suffix}`),
    gofluentDomain: env('GOFLUENT_DOMAIN', 'esaip'),
  };
}
