import { describe, expect, it } from 'vitest';
import { createDb } from '../../src/db/client.js';
import { getSettings, updateSettings } from '../../src/repositories/guilds.js';

describe('guild settings', () => {
  it('falls back to defaults, then keeps each updated field', () => {
    const db = createDb(':memory:');
    expect(getSettings(db, 'g', 'Europe/Paris')).toEqual({
      timezone: 'Europe/Paris',
      organizerRoleId: null,
      reminderEarlyHours: 24,
      reminderLateHours: 2,
    });

    updateSettings(db, 'g', { timezone: 'America/Montreal' });
    updateSettings(db, 'g', { organizerRoleId: 'r1', reminderEarlyHours: 48 });
    expect(getSettings(db, 'g', 'Europe/Paris')).toEqual({
      timezone: 'America/Montreal',
      organizerRoleId: 'r1',
      reminderEarlyHours: 48,
      reminderLateHours: 2,
    });
    expect(getSettings(db, 'other', 'UTC').timezone).toBe('UTC');
  });
});
