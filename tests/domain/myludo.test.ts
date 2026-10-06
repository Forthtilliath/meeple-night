import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMyLudoExport, parseRange } from '../../src/domain/myludo.js';

const sample = readFileSync(new URL('../fixtures/myludo-sample.json', import.meta.url), 'utf8');

describe('parseRange', () => {
  it.each([
    ['2 — 7', { min: 2, max: 7 }],
    ['60 — 120', { min: 60, max: 120 }],
    ['2 - 4', { min: 2, max: 4 }],
    ['2+', { min: 2, max: null }],
    ['10+', { min: 10, max: null }],
    ['Duo', { min: 2, max: 2 }],
    ['Solo', { min: 1, max: 1 }],
    ['4', { min: 4, max: 4 }],
    [45, { min: 45, max: 45 }],
    ['', { min: null, max: null }],
    [undefined, { min: null, max: null }],
  ])('parses %j', (input, expected) => {
    expect(parseRange(input)).toEqual(expected);
  });
});

describe('parseMyLudoExport', () => {
  it('keeps only playable games and counts skipped entries', () => {
    const { games, skipped } = parseMyLudoExport(sample);
    expect(games.map((g) => g.title)).toEqual([
      '7 Wonders',
      '6 qui Surprend !',
      'Jeu en duo',
      'Grande soirée',
    ]);
    expect(skipped).toBe(2);
  });

  it('maps MyLudo fields', () => {
    const [sevenWonders, sixQuiPrend, duo] = parseMyLudoExport(sample).games;
    expect(sevenWonders).toEqual({
      myludoId: 4680,
      title: '7 Wonders',
      year: 2010,
      minPlayers: 2,
      maxPlayers: 7,
      minDuration: 30,
      maxDuration: 30,
      minAge: 10,
      categories: ['Jeu de Cartes'],
      mechanics: ['Draft', 'Collection'],
      rating: 7.9,
    });
    expect(sixQuiPrend).toMatchObject({ minDuration: 30, maxDuration: 60, minAge: 8 });
    expect(duo).toMatchObject({ year: null, minPlayers: 2, maxPlayers: 2, categories: [] });
  });

  it('rejects non-array JSON', () => {
    expect(() => parseMyLudoExport('{"Titre":"x"}')).toThrow();
    expect(() => parseMyLudoExport('not json')).toThrow();
  });
});
