import { describe, expect, it } from 'vitest';
import {
  addLocalDays,
  discordTimestamp,
  localDateTime,
  parseLocalDateTime,
} from '../../src/domain/dates.js';

describe('parseLocalDateTime', () => {
  it('converts Paris summer time (UTC+2)', () => {
    expect(parseLocalDateTime('2026-07-14', '20:30', 'Europe/Paris')?.toISOString()).toBe(
      '2026-07-14T18:30:00.000Z',
    );
  });

  it('converts Paris winter time (UTC+1) and accepts French formats', () => {
    expect(parseLocalDateTime('24/12/2026', '20h', 'Europe/Paris')?.toISOString()).toBe(
      '2026-12-24T19:00:00.000Z',
    );
  });

  it('handles the day of a DST change', () => {
    expect(parseLocalDateTime('2026-10-25', '21h00', 'Europe/Paris')?.toISOString()).toBe(
      '2026-10-25T20:00:00.000Z',
    );
  });

  it('works for other timezones', () => {
    expect(parseLocalDateTime('2026-01-15', '19:00', 'America/New_York')?.toISOString()).toBe(
      '2026-01-16T00:00:00.000Z',
    );
  });

  it.each([
    ['2026-02-30', '20:00'],
    ['2026-13-01', '20:00'],
    ['tomorrow', '20:00'],
    ['2026-10-10', '25:00'],
    ['2026-10-10', '20:75'],
  ])('rejects %s %s', (date, time) => {
    expect(parseLocalDateTime(date, time, 'Europe/Paris')).toBeNull();
  });
});

describe('localDateTime', () => {
  it('gives the wall clock of an instant', () => {
    expect(localDateTime(new Date('2026-10-24T18:30:00Z'), 'Europe/Paris')).toEqual({
      date: '2026-10-24',
      time: '20:30',
    });
    expect(localDateTime(new Date('2026-01-16T00:00:00Z'), 'America/New_York')).toEqual({
      date: '2026-01-15',
      time: '19:00',
    });
  });
});

describe('addLocalDays', () => {
  it('keeps the local time across a DST change', () => {
    const before = new Date('2026-10-24T18:30:00Z'); // 20:30 in Paris, summer time
    expect(addLocalDays(before, 7, 'Europe/Paris').toISOString()).toBe('2026-10-31T19:30:00.000Z');
  });

  it('crosses month and year boundaries', () => {
    const night = new Date('2026-12-28T19:00:00Z');
    expect(addLocalDays(night, 14, 'Europe/Paris').toISOString()).toBe('2027-01-11T19:00:00.000Z');
  });
});

describe('discordTimestamp', () => {
  it('formats seconds since epoch', () => {
    expect(discordTimestamp(new Date('2026-01-01T00:00:00Z'), 'R')).toBe('<t:1767225600:R>');
  });
});
