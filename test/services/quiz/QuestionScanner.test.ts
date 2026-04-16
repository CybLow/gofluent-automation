import { describe, expect, test } from 'bun:test';
import { QuestionScanner } from '@/services/quiz/QuestionScanner';

const scanner = new QuestionScanner();

describe('QuestionScanner', () => {
  test('picks up top-level question', () => {
    const data = { id: 'q1', questionType: 'MULTIPLE_CHOICE', solutions: ['A'] };
    const out = scanner.scan(data);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('q1');
  });

  test('finds questions nested under arrays', () => {
    const data = {
      unrelated: { stuff: 42 },
      sections: [
        { title: 'intro' },
        {
          questions: [
            { id: 'q1', questionType: 'A', solutions: ['x'] },
            { id: 'q2', questionType: 'B', solutions: ['y'] },
          ],
        },
      ],
    };
    expect(scanner.scan(data)).toHaveLength(2);
  });

  test('ignores nodes missing id', () => {
    const data = { questionType: 'A' };
    expect(scanner.scan(data)).toHaveLength(0);
  });

  test('ignores nodes missing questionType', () => {
    const data = { id: 'q1' };
    expect(scanner.scan(data)).toHaveLength(0);
  });

  test('has() returns true when at least one question present', () => {
    expect(scanner.has({ q: { id: 'a', questionType: 'b' } })).toBe(true);
    expect(scanner.has({})).toBe(false);
    expect(scanner.has(null)).toBe(false);
  });

  test('does not infinite-loop on self-reference', () => {
    const data: Record<string, unknown> = { id: 'q1', questionType: 'A' };
    data.self = data;
    // Should terminate; may emit the one question multiple times due to re-entry, but at minimum completes.
    const out = scanner.scan(data);
    expect(out.length).toBeGreaterThanOrEqual(1);
  });

  test('non-object inputs return empty', () => {
    expect(scanner.scan(null)).toHaveLength(0);
    expect(scanner.scan(undefined)).toHaveLength(0);
    expect(scanner.scan('string')).toHaveLength(0);
    expect(scanner.scan(42)).toHaveLength(0);
  });
});
