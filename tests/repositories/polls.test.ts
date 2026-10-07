import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../../src/db/client.js';
import { addGame } from '../../src/repositories/games.js';
import { createNight, getNight } from '../../src/repositories/nights.js';
import {
  countOpenPollsBy,
  createPoll,
  duePolls,
  finalizePoll,
  getPoll,
  setVotes,
} from '../../src/repositories/polls.js';

let db: Db;
let ids: number[];

beforeEach(() => {
  db = createDb(':memory:');
  ids = ['Azul', 'Wingspan', 'Splendor'].map(
    (title) =>
      addGame(db, 'g', { title, minPlayers: 2, maxPlayers: 4, minDuration: 30, maxDuration: 30 })
        ?.id ?? 0,
  );
});

const poll = (overrides = {}) =>
  createPoll(db, {
    guildId: 'g',
    channelId: 'c',
    nightId: null,
    players: null,
    createdBy: 'u',
    gameIds: ids,
    ...overrides,
  });

describe('polls repository', () => {
  it('breaks a tie at random and sets the game of the linked night', () => {
    const night = createNight(db, {
      guildId: 'g',
      channelId: 'c',
      title: 'Night',
      location: null,
      startsAt: new Date(Date.now() + 3_600_000),
      maxPlayers: null,
      createdBy: 'u',
    });
    const created = poll({ nightId: night.id });
    setVotes(db, created.id, 'a', [ids[0] ?? 0, ids[1] ?? 0]);
    setVotes(db, created.id, 'b', [ids[1] ?? 0, ids[0] ?? 0]);

    const closed = finalizePoll(db, created, () => 0.99);
    expect(closed.status).toBe('closed');
    expect([ids[0], ids[1]]).toContain(closed.winnerGameId);
    expect(getPoll(db, created.id)?.winnerGameId).toBe(closed.winnerGameId);
    expect(getNight(db, 'g', night.id)?.gameId).toBe(closed.winnerGameId);
  });

  it('closes without a winner when nobody voted', () => {
    expect(finalizePoll(db, poll()).winnerGameId).toBeNull();
  });

  it('lists due polls and counts open polls per member', () => {
    const due = poll({ closesAt: new Date(1000) });
    poll({ closesAt: new Date(Date.now() + 3_600_000) });
    poll();
    expect(duePolls(db, new Date()).map((p) => p.id)).toEqual([due.id]);
    expect(countOpenPollsBy(db, 'g', 'u')).toBe(3);
    finalizePoll(db, due);
    expect(countOpenPollsBy(db, 'g', 'u')).toBe(2);
    expect(duePolls(db, new Date())).toEqual([]);
  });
});
