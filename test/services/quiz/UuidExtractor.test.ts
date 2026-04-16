import { describe, expect, test } from 'bun:test';
import { UuidExtractor } from '@/services/quiz/UuidExtractor';

const UUID = '12345678-1234-1234-1234-123456789abc';

describe('UuidExtractor.extract', () => {
  test('extracts from learning URL', () => {
    expect(UuidExtractor.extract(`https://esaip.gofluent.com/app/dashboard/learning/${UUID}`)).toBe(UUID);
  });

  test('extracts from URL with query string', () => {
    expect(UuidExtractor.extract(`https://x/${UUID}?tab=main`)).toBe(UUID);
  });

  test('extracts from bare UUID', () => {
    expect(UuidExtractor.extract(UUID)).toBe(UUID);
  });

  test('is case-insensitive on hex', () => {
    const upper = UUID.toUpperCase();
    expect(UuidExtractor.extract(upper)).toBe(upper);
  });

  test('returns null when no UUID present', () => {
    expect(UuidExtractor.extract('no uuid here')).toBeNull();
  });

  test('returns first match when multiple UUIDs present', () => {
    const second = '87654321-4321-4321-4321-cba987654321';
    expect(UuidExtractor.extract(`${UUID} then ${second}`)).toBe(UUID);
  });
});

describe('UuidExtractor.isUuid', () => {
  test('valid lowercase UUID', () => {
    expect(UuidExtractor.isUuid(UUID)).toBe(true);
  });

  test('valid uppercase UUID', () => {
    expect(UuidExtractor.isUuid(UUID.toUpperCase())).toBe(true);
  });

  test('rejects too short', () => {
    expect(UuidExtractor.isUuid('abc')).toBe(false);
  });

  test('rejects embedded UUID (must be exact)', () => {
    expect(UuidExtractor.isUuid(`prefix-${UUID}`)).toBe(false);
  });
});
