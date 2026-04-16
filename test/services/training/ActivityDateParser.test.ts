import { describe, expect, test } from 'bun:test';
import { ActivityDateParser } from '@/services/training/ActivityDateParser';

const parser = new ActivityDateParser();

describe('ActivityDateParser', () => {
  test('parses "16 Apr 2026, 06:04:25 PM"', () => {
    const d = parser.parse('16 Apr 2026, 06:04:25 PM');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3); // April
    expect(d.getDate()).toBe(16);
    expect(d.getHours()).toBe(18);
    expect(d.getMinutes()).toBe(4);
    expect(d.getSeconds()).toBe(25);
  });

  test('parses "3 Jan 2025, 07:30:00 AM"', () => {
    const d = parser.parse('3 Jan 2025, 07:30:00 AM');
    expect(d.getMonth()).toBe(0);
    expect(d.getHours()).toBe(7);
  });

  test('12:00 AM -> 00:00', () => {
    const d = parser.parse('1 Feb 2025, 12:00:00 AM');
    expect(d.getHours()).toBe(0);
  });

  test('12:30 PM stays 12:30', () => {
    const d = parser.parse('1 Feb 2025, 12:30:00 PM');
    expect(d.getHours()).toBe(12);
    expect(d.getMinutes()).toBe(30);
  });

  test('full month name "April" still works (regex takes first 3 letters)', () => {
    const d = parser.parse('5 April 2025, 10:00:00 AM');
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(5);
  });

  test('24h format (no AM/PM) keeps hours as-is', () => {
    const d = parser.parse('16 Apr 2026, 23:59:59');
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
  });

  test('empty input returns Invalid Date', () => {
    expect(Number.isNaN(parser.parse('').getTime())).toBe(true);
  });

  test('garbage input falls back to Date constructor (NaN here)', () => {
    expect(Number.isNaN(parser.parse('not a date').getTime())).toBe(true);
  });

  test('ISO fallback works for unrelated formats', () => {
    const d = parser.parse('2026-04-16T18:04:25Z');
    expect(Number.isNaN(d.getTime())).toBe(false);
    expect(d.getUTCFullYear()).toBe(2026);
  });
});
