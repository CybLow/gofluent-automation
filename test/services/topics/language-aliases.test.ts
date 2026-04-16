import { describe, expect, test } from 'bun:test';
import { LANGUAGE_ALIASES, normalizeLanguage } from '@/services/topics/language-aliases';

describe('normalizeLanguage', () => {
  test('lowercases', () => {
    expect(normalizeLanguage('ANGLAIS')).toBe('anglais');
  });

  test('strips accents', () => {
    expect(normalizeLanguage('Français')).toBe('francais');
    expect(normalizeLanguage('Español')).toBe('espanol');
  });

  test('trims whitespace', () => {
    expect(normalizeLanguage('  English  ')).toBe('english');
  });

  test('is idempotent', () => {
    const once = normalizeLanguage('Anglais');
    expect(normalizeLanguage(once)).toBe(once);
  });
});

describe('LANGUAGE_ALIASES', () => {
  test('anglais maps to both english and anglais', () => {
    expect(LANGUAGE_ALIASES.anglais).toContain('english');
    expect(LANGUAGE_ALIASES.anglais).toContain('anglais');
  });

  test('french <-> english pairs are mutually resolvable', () => {
    const pairs: [string, string][] = [
      ['anglais', 'english'],
      ['espagnol', 'spanish'],
      ['allemand', 'german'],
      ['italien', 'italian'],
      ['francais', 'french'],
      ['portugais', 'portuguese'],
    ];
    for (const [fr, en] of pairs) {
      expect(LANGUAGE_ALIASES[fr]).toContain(en);
      expect(LANGUAGE_ALIASES[en]).toContain(fr);
    }
  });

  test('spanish includes espagnol and espanol variants', () => {
    expect(LANGUAGE_ALIASES.spanish).toContain('espagnol');
    expect(LANGUAGE_ALIASES.spanish).toContain('espanol');
  });
});
