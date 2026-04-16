export interface ITopicResolver {
  resolve(language: string): Promise<string>;
}
