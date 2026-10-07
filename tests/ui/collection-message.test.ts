import { describe, expect, it } from 'vitest';
import type { Game } from '../../src/db/schema.js';
import { decodeFilter, PAGE_SIZE, renderCollectionPage } from '../../src/ui/collection-message.js';

const games = Array.from(
  { length: PAGE_SIZE * 2 + 3 },
  (_, i) => ({ id: i + 1, title: `Game ${i + 1}` }) as Game,
);

describe('renderCollectionPage', () => {
  it('shows one page with buttons carrying the filter', () => {
    const page = renderCollectionPage(games, 1, { players: 4, maxDuration: null }, 'en');
    const json = page.components[0]?.toJSON();
    const ids = json?.components.map((c) => ('custom_id' in c ? c.custom_id : ''));
    expect(ids).toEqual(['colpage:0:4::prev', 'colpage:2:4::next']);
    expect(page.embeds[0]?.toJSON().footer?.text).toBe('Page 2/3');
    expect(page.embeds[0]?.toJSON().description?.split('\n')).toHaveLength(PAGE_SIZE);
  });

  it('clamps the page and has no buttons for a single page', () => {
    const last = renderCollectionPage(games, 99, {}, 'en');
    expect(last.embeds[0]?.toJSON().description?.split('\n')).toHaveLength(3);
    expect(renderCollectionPage(games.slice(0, 3), 0, {}, 'en').components).toEqual([]);
  });

  it('decodes the filter of a custom id', () => {
    expect(decodeFilter('4', '')).toEqual({ players: 4, maxDuration: null });
  });
});
