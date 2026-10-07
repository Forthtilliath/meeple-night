import type { GameNight, Rsvp } from '../db/schema.js';

export const HOUR_MS = 60 * 60 * 1000;

/** First ("early") and second ("late") reminder, in hours before the night. */
export interface ReminderDelays {
  earlyHours: number;
  lateHours: number;
}

export const DEFAULT_DELAYS: ReminderDelays = { earlyHours: 24, lateHours: 2 };

export type ReminderKind = 'early' | 'late';

export interface DueReminder {
  night: GameNight;
  kind: ReminderKind;
}

/**
 * Returns the reminders to send now. Only the closest one is sent: a night created
 * 3 hours before it starts gets no "tomorrow" reminder, only the "in 2 hours" one later.
 */
export function dueReminders(
  nights: GameNight[],
  now: Date,
  delaysOf: (night: GameNight) => ReminderDelays = () => DEFAULT_DELAYS,
): DueReminder[] {
  const due: DueReminder[] = [];
  for (const night of nights) {
    if (night.status !== 'scheduled') continue;
    const remaining = night.startsAt.getTime() - now.getTime();
    if (remaining <= 0) continue;
    const { earlyHours, lateHours } = delaysOf(night);
    if (remaining <= lateHours * HOUR_MS) {
      if (!night.reminderHoursSent) due.push({ night, kind: 'late' });
    } else if (remaining <= earlyHours * HOUR_MS && !night.reminderDaySent) {
      due.push({ night, kind: 'early' });
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
