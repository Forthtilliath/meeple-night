import type { Client } from 'discord.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../../src/bot/types.js';
import { createDb } from '../../src/db/client.js';
import { updateSettings } from '../../src/repositories/guilds.js';
import { createNight, getNight, setRsvp } from '../../src/repositories/nights.js';
import { checkReminders } from '../../src/scheduler/reminders.js';
import { discordError, fakeChannel, MISSING_ACCESS } from '../helpers/discord.js';

const now = new Date('2026-10-10T12:00:00Z');

afterEach(() => {
  vi.restoreAllMocks();
});

function setup(fetch: () => Promise<unknown>) {
  const db = createDb(':memory:');
  const client = { channels: { fetch: vi.fn(fetch) } } as unknown as Client;
  const ctx: BotContext = { client, db, timezone: 'Europe/Paris' };
  const night = createNight(db, {
    guildId: 'g',
    channelId: 'c',
    title: 'Soirée [jeux]',
    location: null,
    startsAt: new Date(now.getTime() + 3_600_000),
    maxPlayers: null,
    createdBy: 'u',
  });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  return { ctx, db, night };
}

describe('checkReminders', () => {
  it('pings attendees once, with the title escaped', async () => {
    const { channel, sent } = fakeChannel();
    const { ctx, db, night } = setup(async () => channel);
    setRsvp(db, night.id, 'a', 'yes');
    setRsvp(db, night.id, 'b', 'no');

    await checkReminders(ctx, now);
    await checkReminders(ctx, now);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.content).toContain('Soirée \\[jeux\\]');
    expect(sent[0]?.allowedMentions).toEqual({ users: ['a'] });
  });

  it('retries after a transient error but drops a channel it cannot access', async () => {
    const transient = setup(async () => {
      throw new Error('network down');
    });
    await checkReminders(transient.ctx, now);
    expect(getNight(transient.db, 'g', transient.night.id)?.reminderHoursSent).toBe(false);

    const permanent = setup(async () => {
      throw discordError(MISSING_ACCESS);
    });
    await checkReminders(permanent.ctx, now);
    expect(getNight(permanent.db, 'g', permanent.night.id)?.reminderHoursSent).toBe(true);
  });

  it('follows the reminder delays of the server', async () => {
    const { channel, sent } = fakeChannel();
    const { ctx, db } = setup(async () => channel);
    updateSettings(db, 'g', { reminderEarlyHours: 3, reminderLateHours: 1 });
    await checkReminders(ctx, new Date(now.getTime() - 90 * 60_000));
    expect(sent[0]?.content).toContain('📅');
  });
});
