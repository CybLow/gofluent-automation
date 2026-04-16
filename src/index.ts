import { Command } from 'commander';
import { loadConfig } from './config.js';
import { Logger } from './utils/logger.js';
import { AutoRunner } from './runners/AutoRunner.js';
import { SimpleRunner } from './runners/SimpleRunner.js';
import type { CLIOptions, CEFRLevel } from './types.js';

const program = new Command()
  .name('gofluent-auto')
  .description('Automate GoFluent language learning activities')
  .version('1.0.0');

program
  .option('--auto-run <count>', 'Number of activities to complete this month', (v: string) => Number.parseInt(v, 10))
  .option('--simple-run <url>', 'Solve a single activity by URL')
  .option('--vocabulary', 'Target vocabulary activities')
  .option('--grammar', 'Target grammar activities')
  .option('--language <name>', 'Learning language (e.g., Anglais, Espagnol)', 'Anglais')
  .option('--debug', 'Enable verbose logging', false)
  .option('--no-headless', 'Show browser window (default: headless)')
  .option('--no-cache', 'Disable activity URL caching')
  .option('--no-api', 'Disable API answer interception (force AI mode)')
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
  language: opts.language,
  debug: opts.debug,
  headless: opts.headless !== false,
  cache: opts.cache !== false,
  profile: opts.profile,
  minimumLevel: opts.minimumLevel as CEFRLevel | undefined,
  maximumLevel: opts.maximumLevel as CEFRLevel | undefined,
  noApi: opts.api === false,
};

async function main() {
  const logger = new Logger(options.debug);
  const config = loadConfig(options.profile);

  logger.info('GoFluent Automation starting...');
  const modeLabel = options.autoRun === undefined
    ? `simple-run (${options.simpleRun})`
    : `auto-run (${options.autoRun})`;
  logger.info(`Mode: ${modeLabel}`);
  logger.info(`Language: ${options.language}`);

  try {
    if (options.autoRun !== undefined) {
      const runner = new AutoRunner(options, config, logger);
      await runner.execute();
    } else if (options.simpleRun) {
      const runner = new SimpleRunner(options, config, logger);
      await runner.execute();
    } else {
      // Default: auto-run 13 activities
      options.autoRun = 13;
      const runner = new AutoRunner(options, config, logger);
      await runner.execute();
    }
  } catch (e) {
    logger.error(`Fatal error: ${e}`);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nInterrupted. Shutting down...');
  process.exit(0);
});

await main();
