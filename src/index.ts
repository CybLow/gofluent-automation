import chalk from 'chalk';
import { modeLabel, parseCli } from '@/cli';
import { buildContainer } from '@/container';

async function main(): Promise<void> {
  try {
    const parsed = parseCli();
    const { runner, logger } = await buildContainer(parsed);
    logger.line(chalk.bold.cyan('\n  GoFluent Automation'));
    logger.line(chalk.gray(`  language: ${parsed.common.language}   mode: ${modeLabel(parsed)}\n`));
    try {
      await runner.execute();
    } finally {
      logger.close();
    }
    process.exit(0);
  } catch (e) {
    console.error(chalk.red(`✗ ${e instanceof Error ? e.message : String(e)}`));
    process.exit(1);
  }
}

process.on('SIGINT', () => { console.log('\nShutting down…'); process.exit(0); });
await main();
