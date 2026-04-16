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

  private write(level: string, msg: string, rendered: string): void {
    console.log(rendered);
    this.fileStream?.write(`${new Date().toISOString()} [${level}] ${msg}\n`);
  }

  /** Main action in progress (arrow prefix) */
  step(m: string): void {
    this.write('STEP', m, `${chalk.cyan('→')} ${m}`);
  }

  /** Successful result (green check) */
  success(m: string): void {
    this.write('OK', m, `${chalk.green('✓')} ${m}`);
  }

  /** Non-fatal warning (yellow) */
  warn(m: string): void {
    this.write('WARN', m, `${chalk.yellow('!')} ${chalk.yellow(m)}`);
  }

  /** Error (red) */
  error(m: string): void {
    this.write('ERROR', m, `${chalk.red('✗')} ${chalk.red(m)}`);
  }

  /** Neutral informational line */
  info(m: string): void {
    this.write('INFO', m, `  ${chalk.gray(m)}`);
  }

  /** Plain untouched line (used for banners/titles) */
  line(m: string): void {
    console.log(m);
    this.fileStream?.write(`${new Date().toISOString()} [LINE] ${m.replace(/\x1b\[[0-9;]*m/g, '')}\n`);
  }

  /** Debug — only printed with --debug, always logged to file */
  debug(m: string): void {
    this.fileStream?.write(`${new Date().toISOString()} [DEBUG] ${m}\n`);
    if (this.debugEnabled) console.log(`${chalk.gray(this.ts())} ${chalk.magenta('DEBUG')} ${m}`);
  }

  close(): void {
    this.fileStream?.end();
    this.fileStream = null;
  }
}
