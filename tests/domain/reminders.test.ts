import { describe, expect, it } from 'vitest';
import type { GameNight, Rsvp } from '../../src/db/schema.js';
import { attendance, dueReminders } from '../../src/domain/reminders.js';

const now = new Date('2026-10-10T12:00:00Z');
const hours = (h: number) => new Date(now.getTime() + h * 3_600_000);

function night(id: number, startsAt: Date, overrides: Partial<GameNight> = {}): GameNight {
  return {
    id,
    guildId: 'g',
    channelId: 'c',
    messageId: null,
    title: 'Night',
    location: null,
    startsAt,
    maxPlayers: null,
    createdBy: 'u',
    status: 'scheduled',
    reminderDaySent: false,
    reminderHoursSent: false,
    gameId: null,
    scheduledEventId: null,
    recurrence: null,
    startHandled: false,
    createdAt: now,
    ...overrides,
  };
}

describe('dueReminders', () => {
  it('sends the day reminder within 24h and the hours reminder within 2h', () => {
    const due = dueReminders([night(1, hours(30)), night(2, hours(20)), night(3, hours(1))], now);
    expect(due.map((d) => [d.night.id, d.kind])).toEqual([
      [2, 'day'],
      [3, 'hours'],
    ]);
  });

  it('skips sent reminders, past and cancelled nights', () => {
    const due = dueReminders(
      [
        night(1, hours(20), { reminderDaySent: true }),
        night(2, hours(1), { reminderHoursSent: true }),
        night(3, hours(-1)),
        night(4, hours(1), { status: 'cancelled' }),
      ],
      now,
    );
    expect(due).toEqual([]);
  });

  it('does not send a late day reminder once in the 2h window', () => {
    const due = dueReminders([night(1, hours(1.5), { reminderDaySent: false })], now);
    expect(due.map((d) => d.kind)).toEqual(['hours']);
  });
});

describe('attendance', () => {
  const rsvp = (userId: string, status: Rsvp['status'], minute: number): Rsvp => ({
    nightId: 1,
    userId,
    status,
    updatedAt: new Date(now.getTime() + minute * 60_000),
  });

  it('puts late "yes" answers on the waitlist', () => {
    const result = attendance(
      [rsvp('c', 'yes', 3), rsvp('a', 'yes', 1), rsvp('b', 'yes', 2), rsvp('d', 'maybe', 0)],
      2,
    );
    expect(result).toEqual({ confirmed: ['a', 'b'], waitlist: ['c'], maybe: ['d'], declined: [] });
  });

  it('has no waitlist without a cap', () => {
    const result = attendance([rsvp('a', 'yes', 1), rsvp('b', 'no', 2)], null);
    expect(result).toMatchObject({ confirmed: ['a'], waitlist: [], declined: ['b'] });
  });
});
