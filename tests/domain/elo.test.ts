import { describe, expect, it } from 'vitest';
import {
  computeRatings,
  eloDeltas,
  INITIAL_RATING,
  K_FACTOR,
  ranksFromScores,
  standings,
} from '../../src/domain/elo.js';

describe('eloDeltas', () => {
  it('gives +K/2 and -K/2 for a duel between equal players', () => {
    const deltas = eloDeltas(
      [
        { userId: 'a', rank: 1 },
        { userId: 'b', rank: 2 },
      ],
      new Map(),
    );
    expect(deltas.get('a')).toBeCloseTo(K_FACTOR / 2);
    expect(deltas.get('b')).toBeCloseTo(-K_FACTOR / 2);
  });

  it('is zero-sum in a multiplayer game', () => {
    const deltas = eloDeltas(
      [
        { userId: 'a', rank: 1 },
        { userId: 'b', rank: 2 },
        { userId: 'c', rank: 2 },
        { userId: 'd', rank: 4 },
      ],
      new Map([['a', 1200]]),
    );
    const sum = [...deltas.values()].reduce((acc, d) => acc + d, 0);
    expect(sum).toBeCloseTo(0);
    expect(deltas.get('b')).toBeCloseTo(deltas.get('c') ?? Number.NaN);
  });

  it('rewards an upset more than an expected win', () => {
    const ratings = new Map([
      ['strong', 1400],
      ['weak', 1000],
    ]);
    const upset = eloDeltas(
      [
        { userId: 'weak', rank: 1 },
        { userId: 'strong', rank: 2 },
      ],
      ratings,
    );
    expect(upset.get('weak')).toBeGreaterThan(K_FACTOR / 2);
  });

  it('ignores plays with a single player', () => {
    expect(eloDeltas([{ userId: 'a', rank: 1 }], new Map()).size).toBe(0);
  });
});

describe('computeRatings', () => {
  const history = [
    {
      gameId: 1,
      placements: [
        { userId: 'a', rank: 1 },
        { userId: 'b', rank: 2 },
      ],
    },
    {
      gameId: 2,
      placements: [
        { userId: 'b', rank: 1 },
        { userId: 'a', rank: 2 },
      ],
    },
  ];

  it('replays all plays in order for the overall ranking', () => {
    // b wins the second play as the lower-rated player, so it gains more than it lost.
    const ratings = computeRatings(history);
    expect(ratings.get('a')).toBeLessThan(INITIAL_RATING);
    expect(ratings.get('b')).toBeGreaterThan(INITIAL_RATING);
  });

  it('filters by game', () => {
    const ratings = computeRatings(history, 1);
    expect(ratings.get('a')).toBeCloseTo(INITIAL_RATING + K_FACTOR / 2);
  });
});

describe('standings', () => {
  it('sorts players by rating and counts their plays', () => {
    const history = [
      {
        gameId: 1,
        placements: [
          { userId: 'a', rank: 1 },
          { userId: 'b', rank: 2 },
        ],
      },
      {
        gameId: 2,
        placements: [
          { userId: 'c', rank: 1 },
          { userId: 'a', rank: 2 },
        ],
      },
    ];
    expect(standings(history).map((s) => [s.userId, s.plays])).toEqual([
      ['c', 1],
      ['a', 2],
      ['b', 1],
    ]);
    expect(standings(history, 2).map((s) => s.userId)).toEqual(['c', 'a']);
  });
});

describe('ranksFromScores', () => {
  it('ranks by descending score with ties', () => {
    expect(ranksFromScores([30, 45, 30, 10])).toEqual([2, 1, 2, 4]);
  });
});
