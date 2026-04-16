export interface IApiClient {
  readonly base: string;
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body: unknown): Promise<T>;
  postRaw(path: string, body: unknown): Promise<Response>;
}
