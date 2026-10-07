import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDb } from '../../src/db/client.js';
import { parseMyLudoExport } from '../../src/domain/myludo.js';
import { importGames, listGames } from '../../src/repositories/games.js';
import {
  getSettings,
  purgeGuild,
  serverLocale,
  updateSettings,
} from '../../src/repositories/guilds.js';
import { createNight, setRsvp } from '../../src/repositories/nights.js';
import { playHistory, recordPlay } from '../../src/repositories/plays.js';
import { createPoll, setVotes } from '../../src/repositories/polls.js';

const sample = readFileSync(new URL('../fixtures/myludo-sample.json', import.meta.url), 'utf8');

describe('guild settings', () => {
  it('falls back to defaults, then keeps each updated field', () => {
    const db = createDb(':memory:');
    expect(getSettings(db, 'g', 'Europe/Paris')).toEqual({
      timezone: 'Europe/Paris',
      organizerRoleId: null,
      reminderEarlyHours: 24,
      reminderLateHours: 2,
      locale: null,
    });

    updateSettings(db, 'g', { timezone: 'America/Montreal' });
    updateSettings(db, 'g', { organizerRoleId: 'r1', reminderEarlyHours: 48 });
    expect(getSettings(db, 'g', 'Europe/Paris')).toEqual({
      timezone: 'America/Montreal',
      organizerRoleId: 'r1',
      reminderEarlyHours: 48,
      reminderLateHours: 2,
      locale: null,
    });
    expect(getSettings(db, 'other', 'UTC').timezone).toBe('UTC');
  });

  it('prefers the server language setting over the Discord one', () => {
    const db = createDb(':memory:');
    expect(serverLocale(db, 'g', 'en-US')).toBe('en-US');
    updateSettings(db, 'g', { locale: 'fr' });
    expect(serverLocale(db, 'g', 'en-US')).toBe('fr');
    updateSettings(db, 'g', { locale: null });
    expect(serverLocale(db, 'g', 'en-US')).toBe('en-US');
  });
});

describe('purgeGuild', () => {
  it('removes every row of the guild and only of that guild', () => {
    const db = createDb(':memory:');
    for (const guildId of ['g', 'keep']) {
      importGames(db, guildId, parseMyLudoExport(sample).games);
      const [first, second] = listGames(db, guildId);
      const gameIds = [first?.id ?? 0, second?.id ?? 0];
      const night = createNight(db, {
        guildId,
        channelId: 'c',
        title: 'Night',
        location: null,
        startsAt: new Date(),
        maxPlayers: null,
        createdBy: 'u',
      });
      setRsvp(db, night.id, 'u', 'yes');
      const poll = createPoll(db, {
        guildId,
        channelId: 'c',
        nightId: night.id,
        players: null,
        createdBy: 'u',
        gameIds,
      });
      setVotes(db, poll.id, 'u', gameIds);
      recordPlay(db, {
        guildId,
        gameId: gameIds[0] ?? 0,
        playedAt: new Date(),
        recordedBy: 'u',
        players: [
          { userId: 'a', rank: 1, score: null },
          { userId: 'b', rank: 2, score: null },
        ],
      });
      updateSettings(db, guildId, { organizerRoleId: 'r' });
    }

    purgeGuild(db, 'g');

    expect(listGames(db, 'g')).toEqual([]);
    expect(playHistory(db, 'g')).toEqual([]);
    expect(getSettings(db, 'g', 'UTC').organizerRoleId).toBeNull();
    expect(listGames(db, 'keep')).toHaveLength(4);
    expect(playHistory(db, 'keep')).toHaveLength(1);
    const remaining = db.$client.prepare('select count(*) as n from rsvps').get() as { n: number };
    expect(remaining.n).toBe(1);
  });
});
