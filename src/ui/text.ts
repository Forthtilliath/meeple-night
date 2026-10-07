/** Characters that start Discord markdown, masked links, mentions or timestamps. */
const MARKDOWN = /[\\*_~`|[\]()<>#]/g;

/**
 * Escapes user-provided text (night titles, locations, imported game titles) so it shows
 * exactly as typed: no formatting, no fake `[link](url)`, no `<@mention>` or `<t:…>`.
 * Embed titles don't need it: they render neither links nor mentions.
 */
export function plain(text: string): string {
  return text.replace(MARKDOWN, (char) => `\\${char}`);
}
