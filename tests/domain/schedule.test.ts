import { describe, expect, it } from 'vitest';
import { nextOccurrence, nightEnd } from '../../src/domain/schedule.js';

const start = new Date('2026-10-02T18:00:00Z'); // Friday 20:00 in Paris

describe('nextOccurrence', () => {
  it('plans the next week, or two weeks later', () => {
    const now = new Date('2026-10-02T18:01:00Z');
    expect(nextOccurrence(start, 'weekly', 'Europe/Paris', now).toISOString()).toBe(
      '2026-10-09T18:00:00.000Z',
    );
    expect(nextOccurrence(start, 'biweekly', 'Europe/Paris', now).toISOString()).toBe(
      '2026-10-16T18:00:00.000Z',
    );
  });

  it('skips the occurrences missed while offline, keeping the local time', () => {
    const now = new Date('2026-10-28T12:00:00Z');
    expect(nextOccurrence(start, 'weekly', 'Europe/Paris', now).toISOString()).toBe(
      '2026-10-30T19:00:00.000Z',
    );
  });
});

describe('nightEnd', () => {
  it('assumes a four-hour night', () => {
    expect(nightEnd(start).toISOString()).toBe('2026-10-02T22:00:00.000Z');
  });
});
