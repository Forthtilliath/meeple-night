import { describe, expect, it } from 'vitest';
import { parseRanking } from '../../src/domain/play-ranking.js';

const candidates = [
  { userId: 'a', names: ['Alice', 'alice_42'] },
  { userId: 'b', names: ['Bob'] },
  { userId: 'c', names: ['Chloé: la reine'] },
];

describe('parseRanking', () => {
  it('ranks by line order, ignoring numbering and case', () => {
    expect(parseRanking('1. bob\n\n2) ALICE_42\n', candidates)).toEqual({
      players: [
        { userId: 'b', rank: 1, score: null },
        { userId: 'a', rank: 2, score: null },
      ],
    });
  });

  it('ranks by scores when every line has one, with ties', () => {
    expect(parseRanking('Alice : 40\nBob = 52\nChloé: la reine : 40', candidates)).toEqual({
      players: [
        { userId: 'a', rank: 2, score: 40 },
        { userId: 'b', rank: 1, score: 52 },
        { userId: 'c', rank: 2, score: 40 },
      ],
    });
  });

  it('reports unknown and duplicate players, partial scores and too few lines', () => {
    expect(parseRanking('Alice\nZoé', candidates)).toEqual({ error: 'unknown', name: 'Zoé' });
    expect(parseRanking('Alice\nalice', candidates)).toEqual({ error: 'duplicate', name: 'alice' });
    expect(parseRanking('Alice : 3\nBob', candidates)).toEqual({ error: 'partialScores' });
    expect(parseRanking('Alice', candidates)).toEqual({ error: 'tooFew' });
  });
});
