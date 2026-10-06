import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en.js';
import { fr } from '../src/i18n/fr.js';
import { t, toLocale } from '../src/i18n/index.js';

function keys(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    child && typeof child === 'object' ? keys(child, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

describe('i18n', () => {
  it('maps Discord locales', () => {
    expect(toLocale('fr')).toBe('fr');
    expect(toLocale('en-US')).toBe('en');
    expect(toLocale('de')).toBe('en');
    expect(toLocale(undefined)).toBe('en');
    expect(t('fr').night.when).toBe('Quand');
  });

  it('has the same keys in every language', () => {
    expect(keys(fr)).toEqual(keys(en));
  });

  it('formats ranges', () => {
    expect(en.common.players(2, 7)).toBe('2–7 players');
    expect(fr.common.players(2, null)).toBe('2+ joueurs');
    expect(fr.common.duration(45, 45)).toBe('45 min');
    expect(fr.collection.listTitle(3)).toBe('Collection — 3 jeux');
  });
});
