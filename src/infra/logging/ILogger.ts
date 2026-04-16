export interface ILogger {
  step(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  info(message: string): void;
  line(message: string): void;
  debug(message: string): void;
  close(): void;
}
