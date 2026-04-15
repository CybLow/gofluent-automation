import chalk from 'chalk';
import { mkdirSync, createWriteStream, type WriteStream } from 'node:fs';
import { join } from 'node:path';

export class Logger {
  private fileStream: WriteStream | null = null;
  private readonly debugEnabled: boolean;

  constructor(debugEnabled = false) {
    this.debugEnabled = debugEnabled;

    const timestamp = new Date().toISOString().replaceAll(':', '_').replaceAll('.', '_').replaceAll('T', '_').slice(0, 19);
    const logDir = join(process.cwd(), 'logs', timestamp);
    mkdirSync(logDir, { recursive: true });
    this.fileStream = createWriteStream(join(logDir, 'run.log'), { flags: 'a' });
  }

  private ts(): string {
    return new Date().toISOString().slice(11, 19);
  }

  private log(level: string, color: (s: string) => string, label: string, message: string): void {
    console.log(`${chalk.gray(this.ts())} ${color(label)} ${message}`);
    this.fileStream?.write(`${new Date().toISOString()} [${level}] ${message}\n`);
  }

  info(message: string): void { this.log('INFO', chalk.blue, 'INFO ', message); }
  success(message: string): void { this.log('OK', chalk.green, 'OK   ', message); }
  warn(message: string): void { this.log('WARN', chalk.yellow, 'WARN ', message); }
  error(message: string): void { this.log('ERROR', chalk.red, 'ERROR', message); }

  debug(message: string): void {
    this.fileStream?.write(`${new Date().toISOString()} [DEBUG] ${message}\n`);
    if (this.debugEnabled) {
      console.log(`${chalk.gray(this.ts())} ${chalk.magenta('DEBUG')} ${message}`);
    }
  }

  close(): void {
    this.fileStream?.end();
    this.fileStream = null;
  }
}
