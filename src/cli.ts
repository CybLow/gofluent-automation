import { Command, InvalidArgumentError } from 'commander';
import { MONTHLY_TARGET_DEFAULT } from '@/constants';
import { ALL_CEFR, CEFR_ORDER, type CEFRLevel } from '@/types/cefr';
import type { AutoOptions, CommonOptions, ParsedCli, ReportOptions, SimpleOptions } from '@/types/options';

export function parseCefrLevel(raw: string): CEFRLevel {
  const normalized = raw.toUpperCase();
  if (!(ALL_CEFR as string[]).includes(normalized)) {
    throw new InvalidArgumentError(
      `invalid CEFR level "${raw}". Expected one of: ${ALL_CEFR.join(', ')}`,
    );
  }
  return normalized as CEFRLevel;
}

export function parsePositiveInt(raw: string): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new InvalidArgumentError(`expected a positive integer, got "${raw}"`);
  }
  return n;
}

function buildProgram(): Command {
  return new Command()
    .name('gofluent-auto')
    .description('Automate GoFluent language learning activities (HTTP-only, 100% score)')
    .version('3.0.0')
    .option('--auto-run <count>', 'Number of activities to complete this month', parsePositiveInt)
    .option('--simple-run <url>', 'Solve a single activity by URL or UUID')
    .option('--report', 'Show training report (scores, stats, history)')
    .option('--vocabulary', 'Target vocabulary activities')
    .option('--grammar', 'Target grammar activities')
    .option('--article', 'Target article activities')
    .option('--video', 'Target video activities')
    .option('--howto', 'Target howto activities')
    .option('--language <name>', 'Learning language (e.g., Anglais, Espagnol)', process.env.GOFLUENT_LANGUAGE || 'Anglais')
    .option('--debug', 'Enable verbose logging', false)
    .option('--no-headless', 'Show browser window (default: headless)')
    .option('--no-cache', 'Disable activity URL caching')
    .option('--profile <name>', 'Credential profile name from .env')
    .option('--minimum-level <level>', 'Minimum CEFR level (A1-C2)', parseCefrLevel)
    .option('--maximum-level <level>', 'Maximum CEFR level (A1-C2)', parseCefrLevel);
}

function extractCommon(raw: Record<string, unknown>): CommonOptions {
  return {
    language: (raw.language as string) ?? 'Anglais',
    debug: raw.debug === true,
    headless: raw.headless !== false,
    profile: raw.profile as string | undefined,
  };
}

function buildAuto(common: CommonOptions, raw: Record<string, unknown>, count: number): AutoOptions {
  return {
    ...common,
    autoRun: count,
    vocabulary: raw.vocabulary === true,
    grammar: raw.grammar === true,
    article: raw.article === true,
    video: raw.video === true,
    howto: raw.howto === true,
    cache: raw.cache !== false,
    minimumLevel: raw.minimumLevel as CEFRLevel | undefined,
    maximumLevel: raw.maximumLevel as CEFRLevel | undefined,
  };
}

function buildSimple(common: CommonOptions, url: string): SimpleOptions {
  return { ...common, simpleRun: url };
}

function buildReport(common: CommonOptions): ReportOptions {
  return common;
}

function assertLevelRange(min?: CEFRLevel, max?: CEFRLevel): void {
  if (!min || !max) return;
  if (CEFR_ORDER[min] > CEFR_ORDER[max]) {
    throw new Error(`--minimum-level (${min}) must be <= --maximum-level (${max})`);
  }
}

export function parseCli(argv: string[] = process.argv): ParsedCli {
  const program = buildProgram();
  program.exitOverride();
  program.configureOutput({ writeErr: () => {} });
  try {
    program.parse(argv);
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'commander.helpDisplayed' || code === 'commander.version') process.exit(0);
    throw e;
  }
  const raw = program.opts();
  const common = extractCommon(raw);

  assertLevelRange(raw.minimumLevel as CEFRLevel | undefined, raw.maximumLevel as CEFRLevel | undefined);

  if (raw.report === true) return { mode: 'report', common, report: buildReport(common) };
  if (typeof raw.simpleRun === 'string' && raw.simpleRun) {
    return { mode: 'simple', common, simple: buildSimple(common, raw.simpleRun) };
  }

  const count = typeof raw.autoRun === 'number' && Number.isFinite(raw.autoRun)
    ? raw.autoRun
    : MONTHLY_TARGET_DEFAULT;
  return { mode: 'auto', common, auto: buildAuto(common, raw, count) };
}

export function modeLabel(parsed: ParsedCli): string {
  if (parsed.mode === 'report') return 'report';
  if (parsed.mode === 'simple') return 'simple-run';
  return `auto-run ${parsed.auto?.autoRun ?? MONTHLY_TARGET_DEFAULT}`;
}
