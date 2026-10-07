import type { Recurrence } from '../db/schema.js';
import { addLocalDays } from './dates.js';

/** Nights have no end time: calendars and Discord events assume this length. */
export const NIGHT_LENGTH_MS = 4 * 60 * 60 * 1000;

export const RECURRENCE_DAYS: Record<Recurrence, number> = { weekly: 7, biweekly: 14 };

export function nightEnd(startsAt: Date): Date {
  return new Date(startsAt.getTime() + NIGHT_LENGTH_MS);
}

/**
 * First occurrence of a recurring night strictly after `now`, at the same local time.
 * Skips the occurrences missed while the bot was offline.
 */
export function nextOccurrence(
  startsAt: Date,
  recurrence: Recurrence,
  timeZone: string,
  now: Date,
): Date {
  let next = startsAt;
  do {
    next = addLocalDays(next, RECURRENCE_DAYS[recurrence], timeZone);
  } while (next <= now);
  return next;
}
