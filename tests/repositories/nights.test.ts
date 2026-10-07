import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../../src/db/client.js';
import {
  cancelNight,
  countUpcomingNightsBy,
  createNight,
  getNight,
  handleNightStart,
  markReminderSent,
  type NewNight,
  nightsToStart,
  updateNight,
} from '../../src/repositories/nights.js';

const now = new Date('2026-10-10T12:00:00Z');
const hours = (h: number) => new Date(now.getTime() + h * 3_600_000);

let db: Db;
const base: NewNight = {
  guildId: 'g',
  channelId: 'c',
  title: 'Night',
  location: null,
  startsAt: hours(5),
  maxPlayers: null,
  createdBy: 'u',
};

beforeEach(() => {
  db = createDb(':memory:');
});

describe('nights repository', () => {
  it('re-arms reminders when the date changes', () => {
    const night = createNight(db, base);
    markReminderSent(db, night.id, 'late');
    updateNight(db, night.id, { title: 'Renamed' });
    expect(getNight(db, 'g', night.id)?.reminderHoursSent).toBe(true);

    const moved = updateNight(db, night.id, { startsAt: hours(30) });
    expect(moved).toMatchObject({
      title: 'Renamed',
      reminderDaySent: false,
      reminderHoursSent: false,
    });
  });

  it('counts the upcoming nights a member organizes', () => {
    createNight(db, base);
    createNight(db, { ...base, startsAt: hours(-5) });
    const cancelled = createNight(db, base);
    cancelNight(db, cancelled.id);
    createNight(db, { ...base, createdBy: 'other' });
    expect(countUpcomingNightsBy(db, 'g', 'u', now)).toBe(1);
  });

  it('processes a started night once and plans its next occurrence', () => {
    const weekly = createNight(db, { ...base, startsAt: hours(-1), recurrence: 'weekly' });
    const single = createNight(db, { ...base, startsAt: hours(-2) });
    createNight(db, base);
    expect(nightsToStart(db, now).map((n) => n.id)).toEqual([weekly.id, single.id]);

    const next = handleNightStart(db, weekly, hours(167));
    expect(next).toMatchObject({ recurrence: 'weekly', startsAt: hours(167), startHandled: false });
    expect(handleNightStart(db, single, null)).toBeNull();
    expect(nightsToStart(db, now)).toEqual([]);
  });
});
