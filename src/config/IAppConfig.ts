export interface IAppConfig {
  readonly gofluentUsername: string;
  readonly gofluentPassword: string;
  readonly gofluentDomain: string;
  siteBase(): string;
}
