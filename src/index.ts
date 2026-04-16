import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, siteBase } from './config.js';
import { Logger } from './logger.js';
import { authenticate } from './auth.js';
import { createApi } from './api.js';
import { resolveTopicUuid } from './services/topic.js';
import { AutoRunner } from './runners/AutoRunner.js';
import { SimpleRunner } from './runners/SimpleRunner.js';
import { ReportRunner } from './runners/ReportRunner.js';
import type { CEFRLevel, CLIOptions } from './types.js';

const program = new Command()
  .name('gofluent-auto')
  .description('Automate GoFluent language learning activities (HTTP-only, 100% score)')
  .version('3.0.0');

program
  .option('--auto-run <count>', 'Number of activities to complete this month', (v: string) => Number.parseInt(v, 10))
  .option('--simple-run <url>', 'Solve a single activity by URL or UUID')
  .option('--report', 'Show training report (scores, stats, history)')
  .option('--vocabulary', 'Target vocabulary activities')
  .option('--grammar', 'Target grammar activities')
  .option('--article', 'Target article activities')
  .option('--video', 'Target video activities')
  .option('--howto', 'Target howto activities')
  .option('--language <name>', 'Learning language (e.g., Anglais, Espagnol)', 'Anglais')
  .option('--debug', 'Enable verbose logging', false)
  .option('--no-headless', 'Show browser window (default: headless)')
  .option('--no-cache', 'Disable activity URL caching')
  .option('--profile <name>', 'Credential profile name from .env')
  .option('--minimum-level <level>', 'Minimum CEFR level (A1-C2)')
  .option('--maximum-level <level>', 'Maximum CEFR level (A1-C2)');

program.parse();
const opts = program.opts();

const options: CLIOptions = {
  autoRun: opts.autoRun,
  simpleRun: opts.simpleRun,
  vocabulary: !!opts.vocabulary,
  grammar: !!opts.grammar,
  article: !!opts.article,
  video: !!opts.video,
  howto: !!opts.howto,
  language: opts.language,
  debug: opts.debug,
  headless: opts.headless !== false,
  cache: opts.cache !== false,
  profile: opts.profile,
  minimumLevel: opts.minimumLevel as CEFRLevel | undefined,
  maximumLevel: opts.maximumLevel as CEFRLevel | undefined,
};

async function main(): Promise<void> {
  const logger = new Logger(options.debug);
  const config = loadConfig(options.profile);

  const header = '\n  GoFluent Automation';
  const meta = `  language: ${options.language}   mode: ${modeLabel()}\n`;
  logger.line(chalk.bold.cyan(header));
  logger.line(chalk.gray(meta));

  try {
    const { token, userId } = await authenticate(config, options.headless, logger);
    const api = createApi(siteBase(config.gofluentDomain), token, logger);

    const topicUuid = await resolveTopicUuid(api, options.language, logger);

    if (opts.report) {
      await new ReportRunner(options, api, userId, topicUuid, logger).execute();
    } else if (options.autoRun !== undefined) {
      await new AutoRunner(options, api, userId, topicUuid, logger).execute();
    } else if (options.simpleRun) {
      await new SimpleRunner(options, api, topicUuid, logger).execute();
    } else {
      options.autoRun = 13;
      await new AutoRunner(options, api, userId, topicUuid, logger).execute();
    }
  } catch (e) {
    logger.error(String(e instanceof Error ? e.message : e));
    logger.close();
    process.exit(1);
  }
  logger.close();
  process.exit(0);
}

function modeLabel(): string {
  if (opts.report) return 'report';
  if (opts.simpleRun) return 'simple-run';
  if (options.autoRun !== undefined) return `auto-run ${options.autoRun}`;
  return 'auto-run 13 (default)';
}

process.on('SIGINT', () => { console.log('\nShutting down…'); process.exit(0); });
await main();
