import { describe, expect, test } from 'bun:test';
import { ReportFormatter } from '@/reporting/ReportFormatter';
import type { ActivityInfo } from '@/types/activity';
import type { TrainingReport } from '@/types/report';

const formatter = new ReportFormatter();

function activity(over: Partial<ActivityInfo> = {}): ActivityInfo {
  return {
    contentUuid: 'abc', url: 'https://x', title: 'An activity',
    date: new Date(), score: 100, contentType: 'activity', ...over,
  };
}

const ANSI_RE = /\x1b\[[0-9;]*m/g;
function plain(lines: string[]): string { return lines.join('\n').replace(ANSI_RE, ''); }

describe('ReportFormatter', () => {
  test('empty report -> single "No activities" line', () => {
    const out = formatter.format({ all: [], monthly: [], monthlyValid: [], monthlyFailed: [] });
    expect(out).toHaveLength(1);
    expect(plain(out)).toContain('No activities');
  });

  test('non-empty report has header and overall section', () => {
    const a = activity();
    const report: TrainingReport = {
      all: [a], monthly: [a], monthlyValid: [a], monthlyFailed: [],
    };
    const text = plain(formatter.format(report));
    expect(text).toContain('GoFluent Training Report');
    expect(text).toContain('Period:');
    expect(text).toContain('Total:');
    expect(text).toContain('Avg score:');
  });

  test('monthly section shows X/target', () => {
    const good = activity({ score: 100 });
    const report: TrainingReport = {
      all: [good], monthly: [good], monthlyValid: [good], monthlyFailed: [],
    };
    const text = plain(formatter.format(report));
    expect(text).toMatch(/Target:\s+1\/\d+/);
  });

  test('failed section present only when monthlyFailed non-empty', () => {
    const pass = activity({ score: 100 });
    const fail = activity({ contentUuid: 'f', score: 50, title: 'Bad one' });

    const withoutFailed = plain(formatter.format({
      all: [pass], monthly: [pass], monthlyValid: [pass], monthlyFailed: [],
    }));
    expect(withoutFailed).not.toContain('Need improvement');

    const withFailed = plain(formatter.format({
      all: [pass, fail], monthly: [pass, fail], monthlyValid: [pass], monthlyFailed: [fail],
    }));
    expect(withFailed).toContain('Need improvement');
    expect(withFailed).toContain('Bad one');
  });

  test('distribution counts perfect and 80-99 buckets', () => {
    const perfect = activity({ contentUuid: 'p', score: 100, title: 'Perfect' });
    const good = activity({ contentUuid: 'g', score: 85, title: 'Good' });
    const text = plain(formatter.format({
      all: [perfect, good], monthly: [perfect, good],
      monthlyValid: [perfect, good], monthlyFailed: [],
    }));
    expect(text).toContain('100%:    1');
    expect(text).toContain('80-99%:  1');
  });
});
