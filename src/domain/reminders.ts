import type { GameNight, Rsvp } from '../db/schema.js';

const HOUR = 60 * 60 * 1000;
export const DAY_REMINDER_MS = 24 * HOUR;
export const HOURS_REMINDER_MS = 2 * HOUR;

export type ReminderKind = 'day' | 'hours';

export interface DueReminder {
  night: GameNight;
  kind: ReminderKind;
}

/**
 * Returns the reminders to send now. Only the closest one is sent: a night created
 * 3 hours before it starts gets no "tomorrow" reminder, only the "in 2 hours" one later.
 */
export function dueReminders(nights: GameNight[], now: Date): DueReminder[] {
  const due: DueReminder[] = [];
  for (const night of nights) {
    if (night.status !== 'scheduled') continue;
    const remaining = night.startsAt.getTime() - now.getTime();
    if (remaining <= 0) continue;
    if (remaining <= HOURS_REMINDER_MS) {
      if (!night.reminderHoursSent) due.push({ night, kind: 'hours' });
    } else if (remaining <= DAY_REMINDER_MS && !night.reminderDaySent) {
      due.push({ night, kind: 'day' });
    }
  }
  return due;
}

export interface Attendance {
  confirmed: string[];
  waitlist: string[];
  maybe: string[];
  declined: string[];
}

/** Splits RSVPs; "yes" answers beyond the player cap go to the waitlist, first come first served. */
export function attendance(rsvps: Rsvp[], maxPlayers: number | null): Attendance {
  const byDate = [...rsvps].sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  const yes = byDate.filter((r) => r.status === 'yes').map((r) => r.userId);
  const cap = maxPlayers ?? yes.length;
  return {
    confirmed: yes.slice(0, cap),
    waitlist: yes.slice(cap),
    maybe: byDate.filter((r) => r.status === 'maybe').map((r) => r.userId),
    declined: byDate.filter((r) => r.status === 'no').map((r) => r.userId),
  };
}
