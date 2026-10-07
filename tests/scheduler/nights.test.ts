import type { Client } from 'discord.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../../src/bot/types.js';
import { createDb } from '../../src/db/client.js';
import { createNight, upcomingNights } from '../../src/repositories/nights.js';
import { handleStartedNights } from '../../src/scheduler/nights.js';
import { fakeChannel } from '../helpers/discord.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('handleStartedNights', () => {
  it('announces the next occurrence of a recurring night once', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const db = createDb(':memory:');
    const { channel, sent } = fakeChannel();
    const client = {
      channels: { fetch: async () => channel },
      guilds: { cache: new Map() },
    } as unknown as Client;
    const ctx: BotContext = { client, db, timezone: 'Europe/Paris' };
    const now = new Date('2026-10-02T18:30:00Z');
    createNight(db, {
      guildId: 'g',
      channelId: 'c',
      title: 'Friday games',
      location: null,
      startsAt: new Date('2026-10-02T18:00:00Z'),
      maxPlayers: null,
      createdBy: 'u',
      recurrence: 'weekly',
    });

    await handleStartedNights(ctx, now);
    await handleStartedNights(ctx, now);

    const upcoming = upcomingNights(db, 'g', now);
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0]?.startsAt.toISOString()).toBe('2026-10-09T18:00:00.000Z');
    expect(upcoming[0]?.messageId).toBe('m1');
    expect(sent).toHaveLength(1);
  });
});
