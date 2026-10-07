import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../../src/db/client.js';
import { parseMyLudoExport } from '../../src/domain/myludo.js';
import { attendance } from '../../src/domain/reminders.js';
import {
  addGame,
  archiveGame,
  importGames,
  listGames,
  searchGames,
} from '../../src/repositories/games.js';
import { createNight, getRsvps, setRsvp } from '../../src/repositories/nights.js';
import { playHistory, recordPlay } from '../../src/repositories/plays.js';
import { createPoll, getPollGames, getVotes, setVotes } from '../../src/repositories/polls.js';

const sample = readFileSync(new URL('../fixtures/myludo-sample.json', import.meta.url), 'utf8');

let db: Db;

beforeEach(() => {
  db = createDb(':memory:');
});

describe('games repository', () => {
  it('imports, then updates on re-import without duplicates', () => {
    const { games } = parseMyLudoExport(sample);
    expect(importGames(db, 'g1', games)).toEqual({ created: 4, updated: 0, archived: 0 });
    expect(importGames(db, 'g1', games)).toEqual({ created: 0, updated: 4, archived: 0 });
    expect(importGames(db, 'g2', games)).toEqual({ created: 4, updated: 0, archived: 0 });
    expect(listGames(db, 'g1')).toHaveLength(4);
  });

  it('archives games missing from a synced import, and restores them later', () => {
    const { games } = parseMyLudoExport(sample);
    importGames(db, 'g1', games);
    const manual = addGame(db, 'g1', {
      title: 'Homemade',
      minPlayers: 2,
      maxPlayers: 4,
      minDuration: 20,
      maxDuration: 20,
    });
    expect(importGames(db, 'g1', games.slice(1), { sync: true }).archived).toBe(1);
    expect(listGames(db, 'g1').map((g) => g.title)).not.toContain(games[0]?.title);
    expect(listGames(db, 'g1').map((g) => g.id)).toContain(manual?.id);
    expect(listGames(db, 'g1', { includeArchived: true })).toHaveLength(5);

    importGames(db, 'g1', games);
    expect(listGames(db, 'g1')).toHaveLength(5);
  });

  it('adds games by hand without duplicates and archives them', () => {
    const game = { title: 'Azul', minPlayers: 2, maxPlayers: 4, minDuration: 40, maxDuration: 40 };
    const added = addGame(db, 'g1', game);
    expect(addGame(db, 'g1', { ...game, title: 'AZUL' })).toBeNull();
    expect(archiveGame(db, 'g1', added?.id ?? 0)).toBe(true);
    expect(archiveGame(db, 'g1', added?.id ?? 0)).toBe(false);
    expect(searchGames(db, 'g1', 'azu')).toEqual([]);
    expect(searchGames(db, 'g1', 'azu', 25, { includeArchived: true })).toHaveLength(1);
    expect(addGame(db, 'g1', game)?.id).toBe(added?.id);
  });

  it('searches titles case-insensitively and escapes wildcards', () => {
    importGames(db, 'g1', parseMyLudoExport(sample).games);
    expect(searchGames(db, 'g1', 'wonder').map((g) => g.title)).toEqual(['7 Wonders']);
    expect(searchGames(db, 'g1', '%')).toEqual([]);
  });
});

describe('nights repository', () => {
  it('keeps the waitlist position when the same answer is clicked twice', () => {
    const night = createNight(db, {
      guildId: 'g1',
      channelId: 'c',
      title: 'Night',
      location: null,
      startsAt: new Date('2026-11-01T19:00:00Z'),
      maxPlayers: 1,
      createdBy: 'u',
    });
    setRsvp(db, night.id, 'a', 'yes', new Date(1000));
    setRsvp(db, night.id, 'b', 'yes', new Date(2000));
    setRsvp(db, night.id, 'a', 'yes', new Date(3000));
    expect(attendance(getRsvps(db, night.id), 1).confirmed).toEqual(['a']);

    setRsvp(db, night.id, 'a', 'maybe', new Date(4000));
    expect(attendance(getRsvps(db, night.id), 1).confirmed).toEqual(['b']);
  });
});

describe('polls repository', () => {
  it('replaces the approvals of a user', () => {
    importGames(db, 'g1', parseMyLudoExport(sample).games);
    const [first, second] = listGames(db, 'g1');
    const ids = [first?.id ?? 0, second?.id ?? 0];
    const poll = createPoll(db, {
      guildId: 'g1',
      channelId: 'c',
      nightId: null,
      players: null,
      createdBy: 'u',
      gameIds: ids,
    });
    setVotes(db, poll.id, 'a', ids);
    setVotes(db, poll.id, 'a', [ids[1] ?? 0]);
    expect(getPollGames(db, poll.id)).toHaveLength(2);
    expect(getVotes(db, poll.id)).toEqual([{ userId: 'a', gameId: ids[1] }]);
  });
});

describe('plays repository', () => {
  it('returns plays in chronological order with their placements', () => {
    importGames(db, 'g1', parseMyLudoExport(sample).games);
    const gameId = listGames(db, 'g1')[0]?.id ?? 0;
    const base = { guildId: 'g1', gameId, recordedBy: 'u' };
    recordPlay(db, {
      ...base,
      playedAt: new Date(2000),
      players: [
        { userId: 'b', rank: 1, score: null },
        { userId: 'a', rank: 2, score: null },
      ],
    });
    recordPlay(db, {
      ...base,
      playedAt: new Date(1000),
      players: [
        { userId: 'a', rank: 1, score: 50 },
        { userId: 'c', rank: 2, score: 40 },
      ],
    });
    const history = playHistory(db, 'g1');
    expect(history.map((p) => p.placements.find((pl) => pl.rank === 1)?.userId)).toEqual([
      'a',
      'b',
    ]);
    expect(playHistory(db, 'other')).toEqual([]);
  });
});
