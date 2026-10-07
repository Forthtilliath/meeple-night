import { describe, expect, it } from 'vitest';
import type { Game } from '../../src/db/schema.js';
import { fitsFilter, pickCandidates, tally, winners } from '../../src/domain/voting.js';

function game(id: number, overrides: Partial<Game> = {}): Game {
  return {
    id,
    guildId: 'g',
    myludoId: null,
    title: `Game ${id}`,
    year: null,
    minPlayers: 2,
    maxPlayers: 4,
    minDuration: 30,
    maxDuration: 60,
    minAge: null,
    categories: [],
    mechanics: [],
    rating: null,
    archived: false,
    createdAt: new Date(0),
    ...overrides,
  };
}

describe('fitsFilter', () => {
  it('checks the player count range', () => {
    expect(fitsFilter(game(1), { players: 4 })).toBe(true);
    expect(fitsFilter(game(1), { players: 5 })).toBe(false);
    expect(fitsFilter(game(1), { players: 1 })).toBe(false);
    expect(fitsFilter(game(1, { maxPlayers: null }), { players: 12 })).toBe(true);
  });

  it('checks the shortest duration', () => {
    expect(fitsFilter(game(1), { maxDuration: 30 })).toBe(true);
    expect(fitsFilter(game(1), { maxDuration: 20 })).toBe(false);
  });
});

describe('pickCandidates', () => {
  it('returns at most `count` matching games without duplicates', () => {
    const games = [game(1), game(2), game(3, { minPlayers: 5, maxPlayers: 8 }), game(4)];
    const picked = pickCandidates(games, { players: 3 }, 2);
    expect(picked).toHaveLength(2);
    expect(new Set(picked.map((g) => g.id)).size).toBe(2);
    expect(picked.every((g) => g.id !== 3)).toBe(true);
  });
});

describe('tally and winners', () => {
  it('sorts by votes and keeps options without votes', () => {
    const results = tally(
      [1, 2, 3],
      [
        { userId: 'a', gameId: 2 },
        { userId: 'b', gameId: 2 },
        { userId: 'a', gameId: 3 },
        { userId: 'c', gameId: 99 },
      ],
    );
    expect(results).toEqual([
      { gameId: 2, votes: 2 },
      { gameId: 3, votes: 1 },
      { gameId: 1, votes: 0 },
    ]);
    expect(winners(results)).toEqual([2]);
  });

  it('returns every tied winner and none without votes', () => {
    expect(
      winners([
        { gameId: 1, votes: 2 },
        { gameId: 2, votes: 2 },
      ]),
    ).toEqual([1, 2]);
    expect(winners(tally([1, 2], []))).toEqual([]);
  });
});
