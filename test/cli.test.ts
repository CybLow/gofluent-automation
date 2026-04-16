import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { parseCefrLevel, parseCli, parseDuration, parsePositiveInt } from '@/cli';
import { MONTHLY_TARGET_DEFAULT } from '@/constants';

describe('parseCefrLevel', () => {
  test('accepts uppercase A1-C2', () => {
    expect(parseCefrLevel('A1')).toBe('A1');
    expect(parseCefrLevel('C2')).toBe('C2');
  });

  test('normalizes lowercase to uppercase', () => {
    expect(parseCefrLevel('b2')).toBe('B2');
    expect(parseCefrLevel('c1')).toBe('C1');
  });

  test('rejects unknown codes', () => {
    expect(() => parseCefrLevel('D1')).toThrow(/invalid CEFR level/);
    expect(() => parseCefrLevel('A3')).toThrow(/invalid CEFR level/);
    expect(() => parseCefrLevel('foo')).toThrow(/invalid CEFR level/);
    expect(() => parseCefrLevel('')).toThrow(/invalid CEFR level/);
  });
});

describe('parsePositiveInt', () => {
  test('accepts positive integers', () => {
    expect(parsePositiveInt('1')).toBe(1);
    expect(parsePositiveInt('13')).toBe(13);
    expect(parsePositiveInt('9999')).toBe(9999);
  });

  test('rejects zero and negatives', () => {
    expect(() => parsePositiveInt('0')).toThrow(/positive integer/);
    expect(() => parsePositiveInt('-5')).toThrow(/positive integer/);
  });

  test('rejects non-numeric input', () => {
    expect(() => parsePositiveInt('abc')).toThrow(/positive integer/);
    expect(() => parsePositiveInt('')).toThrow(/positive integer/);
    expect(() => parsePositiveInt('NaN')).toThrow(/positive integer/);
  });

  test('accepts leading integer and ignores trailing (parseInt behavior)', () => {
    expect(parsePositiveInt('42abc')).toBe(42);
  });
});

describe('parseDuration', () => {
  test('bare number defaults to seconds', () => {
    expect(parseDuration('0')).toBe(0);
    expect(parseDuration('30')).toBe(30_000);
    expect(parseDuration('1.5')).toBe(1500);
  });

  test('ms suffix → milliseconds', () => {
    expect(parseDuration('500ms')).toBe(500);
    expect(parseDuration('0ms')).toBe(0);
  });

  test('s suffix → seconds', () => {
    expect(parseDuration('30s')).toBe(30_000);
    expect(parseDuration('0.5s')).toBe(500);
  });

  test('m suffix → minutes', () => {
    expect(parseDuration('2m')).toBe(120_000);
    expect(parseDuration('0.5m')).toBe(30_000);
  });

  test('h suffix → hours', () => {
    expect(parseDuration('1h')).toBe(3_600_000);
    expect(parseDuration('0.25h')).toBe(900_000);
  });

  test('case-insensitive suffix', () => {
    expect(parseDuration('500MS')).toBe(500);
    expect(parseDuration('2M')).toBe(120_000);
    expect(parseDuration('1H')).toBe(3_600_000);
  });

  test('trims whitespace', () => {
    expect(parseDuration('  30s  ')).toBe(30_000);
  });

  test('rejects negative', () => {
    expect(() => parseDuration('-1s')).toThrow(/duration/);
  });

  test('rejects garbage', () => {
    expect(() => parseDuration('abc')).toThrow(/duration/);
    expect(() => parseDuration('5x')).toThrow(/duration/);
    expect(() => parseDuration('')).toThrow(/duration/);
  });

  test('rejects non-numeric with suffix', () => {
    expect(() => parseDuration('abc s')).toThrow(/duration/);
  });
});

describe('parseCli delay flags', () => {
  test('--question-delay defaults to 0 when omitted', () => {
    const p = parseCli(['bun', 'src/index.ts', '--report']);
    expect(p.common.questionDelayMs).toBe(0);
  });

  test('--activity-delay defaults to 0 when omitted', () => {
    const p = parseCli(['bun', 'src/index.ts', '--auto-run', '1']);
    expect(p.auto?.activityDelayMs).toBe(0);
  });

  test('--question-delay 500ms → 500', () => {
    const p = parseCli(['bun', 'src/index.ts', '--report', '--question-delay', '500ms']);
    expect(p.common.questionDelayMs).toBe(500);
  });

  test('--question-delay 2 (bare) → 2000ms', () => {
    const p = parseCli(['bun', 'src/index.ts', '--report', '--question-delay', '2']);
    expect(p.common.questionDelayMs).toBe(2000);
  });

  test('--activity-delay 1m flows into AutoOptions', () => {
    const p = parseCli(['bun', 'src/index.ts', '--auto-run', '3', '--activity-delay', '1m']);
    expect(p.auto?.activityDelayMs).toBe(60_000);
  });

  test('question delay inherited by SimpleOptions via CommonOptions', () => {
    const p = parseCli(['bun', 'src/index.ts', '--simple-run', 'abc', '--question-delay', '1s']);
    expect(p.simple?.questionDelayMs).toBe(1000);
  });

  test('rejects invalid duration', () => {
    expect(() => parseCli(['bun', 'src/index.ts', '--report', '--question-delay', 'abc'])).toThrow();
  });
});

describe('parseCli mode routing', () => {
  const argv = (...args: string[]) => ['bun', 'src/index.ts', ...args];

  test('--report → report mode', () => {
    const p = parseCli(argv('--report'));
    expect(p.mode).toBe('report');
    expect(p.report).toBeDefined();
    expect(p.auto).toBeUndefined();
    expect(p.simple).toBeUndefined();
  });

  test('--simple-run <uuid> → simple mode', () => {
    const p = parseCli(argv('--simple-run', 'abc-123'));
    expect(p.mode).toBe('simple');
    expect(p.simple?.simpleRun).toBe('abc-123');
  });

  test('no mode flag → auto mode with env/default target', () => {
    const p = parseCli(argv());
    expect(p.mode).toBe('auto');
    expect(p.auto?.autoRun).toBe(MONTHLY_TARGET_DEFAULT);
  });

  test('--auto-run 5 → auto mode with explicit count', () => {
    const p = parseCli(argv('--auto-run', '5'));
    expect(p.mode).toBe('auto');
    expect(p.auto?.autoRun).toBe(5);
  });

  test('--report takes priority over --auto-run', () => {
    const p = parseCli(argv('--report', '--auto-run', '7'));
    expect(p.mode).toBe('report');
  });

  test('--simple-run takes priority over --auto-run', () => {
    const p = parseCli(argv('--simple-run', 'x', '--auto-run', '7'));
    expect(p.mode).toBe('simple');
  });
});

describe('parseCli --auto-run validation', () => {
  test('rejects zero', () => {
    expect(() => parseCli(['bun', 'src/index.ts', '--auto-run', '0'])).toThrow();
  });

  test('rejects negative', () => {
    expect(() => parseCli(['bun', 'src/index.ts', '--auto-run', '-3'])).toThrow();
  });

  test('rejects non-numeric', () => {
    expect(() => parseCli(['bun', 'src/index.ts', '--auto-run', 'abc'])).toThrow();
  });
});

describe('parseCli level range', () => {
  const baseArgv = ['bun', 'src/index.ts', '--report'];

  test('accepts min == max', () => {
    expect(parseCli([...baseArgv, '--minimum-level', 'B2', '--maximum-level', 'B2']).mode).toBe('report');
  });

  test('accepts min < max', () => {
    expect(parseCli([...baseArgv, '--minimum-level', 'A1', '--maximum-level', 'C1']).mode).toBe('report');
  });

  test('rejects min > max', () => {
    expect(() => parseCli([...baseArgv, '--minimum-level', 'C2', '--maximum-level', 'A1']))
      .toThrow(/must be <=/);
  });

  test('only min is fine', () => {
    expect(() => parseCli([...baseArgv, '--minimum-level', 'B2'])).not.toThrow();
  });

  test('only max is fine', () => {
    expect(() => parseCli([...baseArgv, '--maximum-level', 'B2'])).not.toThrow();
  });

  test('level is normalized to uppercase on parsed output', () => {
    const p = parseCli([...baseArgv, '--minimum-level', 'b2', '--maximum-level', 'c1']);
    expect(p.report).toBeDefined();
    // level lives on AutoOptions, not ReportOptions — switch to auto mode to assert
    const a = parseCli(['bun', 'src/index.ts', '--minimum-level', 'a1', '--maximum-level', 'c2']);
    expect(a.auto?.minimumLevel).toBe('A1');
    expect(a.auto?.maximumLevel).toBe('C2');
  });
});

describe('parseCli env fallbacks', () => {
  const savedLang = process.env.GOFLUENT_LANGUAGE;

  beforeEach(() => { delete process.env.GOFLUENT_LANGUAGE; });
  afterEach(() => {
    if (savedLang === undefined) delete process.env.GOFLUENT_LANGUAGE;
    else process.env.GOFLUENT_LANGUAGE = savedLang;
  });

  test('--language defaults to "Anglais" when no env', () => {
    const p = parseCli(['bun', 'src/index.ts', '--report']);
    expect(p.common.language).toBe('Anglais');
  });

  test('GOFLUENT_LANGUAGE env overrides default', () => {
    process.env.GOFLUENT_LANGUAGE = 'Espagnol';
    const p = parseCli(['bun', 'src/index.ts', '--report']);
    expect(p.common.language).toBe('Espagnol');
  });

  test('explicit --language wins over env', () => {
    process.env.GOFLUENT_LANGUAGE = 'Espagnol';
    const p = parseCli(['bun', 'src/index.ts', '--report', '--language', 'Allemand']);
    expect(p.common.language).toBe('Allemand');
  });
});

describe('parseCli common flags', () => {
  const argv = (...args: string[]) => ['bun', 'src/index.ts', ...args];

  test('--debug sets debug true', () => {
    expect(parseCli(argv('--report', '--debug')).common.debug).toBe(true);
  });

  test('debug defaults to false', () => {
    expect(parseCli(argv('--report')).common.debug).toBe(false);
  });

  test('--no-headless sets headless false', () => {
    expect(parseCli(argv('--report', '--no-headless')).common.headless).toBe(false);
  });

  test('--no-cache sets cache false on auto mode', () => {
    expect(parseCli(argv('--auto-run', '1', '--no-cache')).auto?.cache).toBe(false);
  });

  test('cache defaults to true', () => {
    expect(parseCli(argv('--auto-run', '1')).auto?.cache).toBe(true);
  });

  test('category flags flow through', () => {
    const p = parseCli(argv('--auto-run', '1', '--vocabulary', '--grammar'));
    expect(p.auto?.vocabulary).toBe(true);
    expect(p.auto?.grammar).toBe(true);
    expect(p.auto?.article).toBe(false);
    expect(p.auto?.video).toBe(false);
    expect(p.auto?.howto).toBe(false);
  });

  test('--profile flows through', () => {
    expect(parseCli(argv('--report', '--profile', 'work')).common.profile).toBe('work');
  });
});
