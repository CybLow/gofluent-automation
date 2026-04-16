import chalk from 'chalk';
import { mkdirSync, createWriteStream, type WriteStream } from 'node:fs';
import { join } from 'node:path';
import type { ILogger } from './ILogger';

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function timestampFolder(): string {
  return new Date().toISOString()
    .replaceAll(':', '_')
    .replaceAll('.', '_')
    .replaceAll('T', '_')
    .slice(0, 19);
}

export class Logger implements ILogger {
  private stream: WriteStream | null;
  private readonly debugEnabled: boolean;

  constructor(logsDir: string, debugEnabled = false) {
    this.debugEnabled = debugEnabled;
    const runDir = join(logsDir, timestampFolder());
    mkdirSync(runDir, { recursive: true });
    this.stream = createWriteStream(join(runDir, 'run.log'), { flags: 'a' });
  }

  private writeFile(level: string, message: string): void {
    this.stream?.write(`${new Date().toISOString()} [${level}] ${message.replace(ANSI_RE, '')}\n`);
  }

  private emit(level: string, message: string, rendered: string): void {
    console.log(rendered);
    this.writeFile(level, message);
  }

  step(m: string): void    { this.emit('STEP', m, `${chalk.cyan('→')} ${m}`); }
  success(m: string): void { this.emit('OK', m, `${chalk.green('✓')} ${m}`); }
  warn(m: string): void    { this.emit('WARN', m, `${chalk.yellow('!')} ${chalk.yellow(m)}`); }
  error(m: string): void   { this.emit('ERROR', m, `${chalk.red('✗')} ${chalk.red(m)}`); }
  info(m: string): void    { this.emit('INFO', m, `  ${chalk.gray(m)}`); }

  line(m: string): void {
    console.log(m);
    this.writeFile('LINE', m);
  }

  debug(m: string): void {
    this.writeFile('DEBUG', m);
    if (this.debugEnabled) {
      const ts = new Date().toISOString().slice(11, 19);
      console.log(`${chalk.gray(ts)} ${chalk.magenta('DEBUG')} ${m}`);
    }
  }

  close(): void {
    this.stream?.end();
    this.stream = null;
  }
}
