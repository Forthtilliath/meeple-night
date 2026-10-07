import { describe, expect, it } from 'vitest';
import { HOUR_MS } from '../../src/domain/reminders.js';
import {
  firstRenewalReminder,
  isRenewalReminderDue,
  renewalDeadline,
} from '../../src/domain/renewal.js';

const renewedAt = new Date('2026-10-07T12:00:00Z');
const at = (hours: number) => new Date(renewedAt.getTime() + hours * HOUR_MS);

describe('renewal reminder', () => {
  it('computes the deadline and the first reminder a day before', () => {
    expect(renewalDeadline(renewedAt, 4)).toEqual(new Date('2026-10-11T12:00:00Z'));
    expect(firstRenewalReminder(renewedAt, 4)).toEqual(new Date('2026-10-10T12:00:00Z'));
  });

  it('is due from the first reminder, then every 12 hours', () => {
    expect(isRenewalReminderDue(renewedAt, null, 4, at(71))).toBe(false);
    expect(isRenewalReminderDue(renewedAt, null, 4, at(72))).toBe(true);
    expect(isRenewalReminderDue(renewedAt, at(72), 4, at(83))).toBe(false);
    expect(isRenewalReminderDue(renewedAt, at(72), 4, at(84))).toBe(true);
  });

  it('ignores a reminder sent during the previous cycle', () => {
    expect(isRenewalReminderDue(renewedAt, at(-1), 4, at(72))).toBe(true);
  });
});
