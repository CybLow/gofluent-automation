export interface IUrlCacheRepo {
  getAll(): Set<string>;
  add(urls: string[]): void;
}
