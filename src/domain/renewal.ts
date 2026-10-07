import { HOUR_MS } from './reminders.js';

/** The first reminder comes this long before the deadline… */
export const RENEWAL_LEAD_MS = 24 * HOUR_MS;
/** …then it is repeated at this pace until the renewal is confirmed. */
export const RENEWAL_REPEAT_MS = 12 * HOUR_MS;

export function renewalDeadline(renewedAt: Date, days: number): Date {
  return new Date(renewedAt.getTime() + days * 24 * HOUR_MS);
}

export function firstRenewalReminder(renewedAt: Date, days: number): Date {
  return new Date(renewalDeadline(renewedAt, days).getTime() - RENEWAL_LEAD_MS);
}

/**
 * Whether the renewal reminder must be sent now. A reminder sent before the current cycle's
 * first reminder time belongs to a previous cycle, so confirming a renewal needs no reset.
 */
export function isRenewalReminderDue(
  renewedAt: Date,
  remindedAt: Date | null,
  days: number,
  now: Date,
): boolean {
  const first = firstRenewalReminder(renewedAt, days).getTime();
  if (now.getTime() < first) return false;
  return (
    !remindedAt ||
    remindedAt.getTime() < first ||
    now.getTime() - remindedAt.getTime() >= RENEWAL_REPEAT_MS
  );
}
