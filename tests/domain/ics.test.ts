import { describe, expect, it } from 'vitest';
import { buildIcs } from '../../src/domain/ics.js';

const event = {
  uid: 'night-1@meeple-night',
  title: 'Soirée jeux; Azul, Wingspan',
  start: new Date('2026-10-24T18:30:00Z'),
  end: new Date('2026-10-24T22:30:00Z'),
  location: 'Chez Alex\n2e étage',
  url: 'https://discord.com/channels/1/2/3',
};

describe('buildIcs', () => {
  it('builds a CRLF calendar with UTC dates and escaped text', () => {
    const ics = buildIcs(event, new Date('2026-10-07T10:00:00Z'));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261024T183000Z\r\n');
    expect(ics).toContain('DTEND:20261024T223000Z\r\n');
    expect(ics).toContain('DTSTAMP:20261007T100000Z\r\n');
    expect(ics).toContain('SUMMARY:Soirée jeux\\; Azul\\, Wingspan\r\n');
    expect(ics).toContain('LOCATION:Chez Alex\\n2e étage\r\n');
  });

  it('folds long lines at 75 octets without splitting characters', () => {
    const ics = buildIcs({ ...event, title: 'é'.repeat(100) });
    const summary = ics.split('\r\n').filter((line, i, all) => {
      const start = all.findIndex((l) => l.startsWith('SUMMARY:'));
      return i >= start && (i === start || line.startsWith(' '));
    });
    expect(summary.length).toBeGreaterThan(1);
    for (const line of summary) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(summary.map((l, i) => (i === 0 ? l : l.slice(1))).join('')).toBe(
      `SUMMARY:${'é'.repeat(100)}`,
    );
  });
});
