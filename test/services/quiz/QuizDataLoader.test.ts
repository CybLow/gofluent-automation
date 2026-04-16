import { describe, expect, test } from 'bun:test';
import { findQuizRef } from '@/services/quiz/QuizDataLoader';

describe('findQuizRef', () => {
  test('top-level quizUuid', () => {
    expect(findQuizRef({ quizUuid: 'aaa-1' })).toBe('aaa-1');
  });

  test('top-level quizId', () => {
    expect(findQuizRef({ quizId: 'bbb-2' })).toBe('bbb-2');
  });

  test('nested template.quizId', () => {
    expect(findQuizRef({ template: { quizId: 'ccc-3' } })).toBe('ccc-3');
  });

  test('nested quiz.uuid', () => {
    expect(findQuizRef({ quiz: { uuid: 'ddd-4' } })).toBe('ddd-4');
  });

  test('nested legacy.quizUuid', () => {
    expect(findQuizRef({ legacy: { quizUuid: 'eee-5' } })).toBe('eee-5');
  });

  test('fallback walker finds unusual *quiz* key with UUID value', () => {
    const nested = {
      data: {
        deeplyNested: {
          customQuizRef: '12345678-1234-1234-1234-123456789012',
        },
      },
    };
    expect(findQuizRef(nested)).toBe('12345678-1234-1234-1234-123456789012');
  });

  test('walker ignores keys without "quiz" in name even if UUID', () => {
    const nested = { thingId: '12345678-1234-1234-1234-123456789012' };
    expect(findQuizRef(nested)).toBeUndefined();
  });

  test('walker ignores non-UUID strings even in quiz-named keys', () => {
    const nested = { quizRef: 'not-a-uuid-shape' };
    expect(findQuizRef(nested)).toBeUndefined();
  });

  test('returns undefined for unrelated shapes', () => {
    expect(findQuizRef({ foo: 'bar' })).toBeUndefined();
    expect(findQuizRef(null)).toBeUndefined();
    expect(findQuizRef(undefined)).toBeUndefined();
  });

  test('handles cyclic structures without stack overflow', () => {
    const a: Record<string, unknown> = { name: 'a' };
    const b: Record<string, unknown> = { name: 'b', a };
    a.b = b;
    expect(findQuizRef(a)).toBeUndefined();
  });

  test('prefers explicit key over walker result', () => {
    const data = {
      quizUuid: 'explicit',
      customQuizRef: '12345678-1234-1234-1234-123456789012',
    };
    expect(findQuizRef(data)).toBe('explicit');
  });
});
