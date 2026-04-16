import type { IAppConfig } from './IAppConfig';

function readEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export class EnvAppConfig implements IAppConfig {
  readonly gofluentUsername: string;
  readonly gofluentPassword: string;
  readonly gofluentDomain: string;

  constructor(profile?: string) {
    const suffix = profile ? `__${profile.toUpperCase()}` : '';
    this.gofluentUsername = readEnv(`GOFLUENT_USERNAME${suffix}`);
    this.gofluentPassword = readEnv(`GOFLUENT_PASSWORD${suffix}`);
    this.gofluentDomain = readEnv(`GOFLUENT_DOMAIN${suffix}`, 'esaip');
  }

  siteBase(): string {
    return `https://${this.gofluentDomain}.gofluent.com`;
  }
}
