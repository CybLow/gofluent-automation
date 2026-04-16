import { describe, expect, test } from 'bun:test';
import { ActivityMapper } from '@/services/training/ActivityMapper';

const SITE = 'https://esaip.gofluent.com';
const mapper = new ActivityMapper(SITE);

describe('ActivityMapper', () => {
  test('missing contentUuid returns null', () => {
    expect(mapper.map({ completionDate: '16 Apr 2026, 06:00:00 PM' })).toBeNull();
  });

  test('missing completionDate returns null', () => {
    expect(mapper.map({ contentUuid: 'abc-123' })).toBeNull();
  });

  test('unparseable date returns null', () => {
    expect(mapper.map({ contentUuid: 'abc-123', completionDate: 'bogus' })).toBeNull();
  });

  test('score "100%" -> 100', () => {
    const info = mapper.map({
      contentUuid: 'abc-123', completionDate: '16 Apr 2026, 06:00:00 PM', score: '100%',
    });
    expect(info?.score).toBe(100);
  });

  test('score "82%" -> 82', () => {
    const info = mapper.map({
      contentUuid: 'abc', completionDate: '16 Apr 2026, 06:00:00 PM', score: '82%',
    });
    expect(info?.score).toBe(82);
  });

  test('non-numeric score returns null for score field', () => {
    const info = mapper.map({
      contentUuid: 'abc', completionDate: '16 Apr 2026, 06:00:00 PM', score: 'A1.1 [CEFR Pre-A1]',
    });
    expect(info?.score).toBeNull();
  });

  test('URL built from siteBase + contentUuid', () => {
    const info = mapper.map({
      contentUuid: 'ABC-Def', completionDate: '16 Apr 2026, 06:00:00 PM', score: '50%',
    });
    expect(info?.url).toBe(`${SITE}/app/dashboard/learning/abc-def`);
  });

  test('contentUuid is lowercased', () => {
    const info = mapper.map({
      contentUuid: 'ABC-DEF', completionDate: '16 Apr 2026, 06:00:00 PM',
    });
    expect(info?.contentUuid).toBe('abc-def');
  });

  test('contentType defaults to "activity" when missing', () => {
    const info = mapper.map({
      contentUuid: 'abc', completionDate: '16 Apr 2026, 06:00:00 PM',
    });
    expect(info?.contentType).toBe('activity');
  });
});
