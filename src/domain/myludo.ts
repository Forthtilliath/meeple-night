import type { NewGame } from '../db/schema.js';

/** Subset of a MyLudo collection export entry (French keys, as exported). */
interface MyLudoEntry {
  ID?: number;
  Titre?: string;
  Édition?: number | string;
  Type?: string;
  'Joueur(s)'?: string;
  Durée?: number | string;
  'Age(s)'?: string;
  'Catégorie(s)'?: string[];
  'Mécanisme(s)'?: string[];
  'Note moyenne'?: number;
}

export type ImportedGame = Omit<NewGame, 'id' | 'guildId' | 'createdAt'>;

export interface MyLudoParseResult {
  games: ImportedGame[];
  /** Entries that are not playable on their own (extensions, accessories, goodies). */
  skipped: number;
}

/** Only these types can be put on the table by themselves. */
const PLAYABLE_TYPES = new Set(['basegame', 'standalone']);

const RANGE_SEPARATOR = /\s*[—–-]\s*/;

export interface Range {
  min: number | null;
  max: number | null;
}

/** Parses "2 — 7", "2+", "Duo", "Solo", "4" or 45 into a numeric range. */
export function parseRange(value: unknown): Range {
  if (typeof value === 'number') return { min: value, max: value };
  if (typeof value !== 'string' || value.trim() === '') return { min: null, max: null };
  const text = value.trim().toLowerCase();
  if (text === 'solo') return { min: 1, max: 1 };
  if (text === 'duo') return { min: 2, max: 2 };
  const plus = /^(\d+)\s*\+$/.exec(text);
  if (plus) return { min: Number(plus[1]), max: null };
  const [low, high] = text.split(RANGE_SEPARATOR).map(toInt);
  if (low === undefined || low === null) return { min: null, max: null };
  return { min: low, max: high ?? low };
}

function toInt(value: string): number | null {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function parseMyLudoEntry(entry: MyLudoEntry): ImportedGame | null {
  const title = entry.Titre?.trim();
  if (!title || !PLAYABLE_TYPES.has(entry.Type ?? '')) return null;
  const players = parseRange(entry['Joueur(s)']);
  const duration = parseRange(entry.Durée);
  const year = Number(entry.Édition);
  return {
    myludoId: typeof entry.ID === 'number' ? entry.ID : null,
    title,
    year: Number.isInteger(year) && year > 0 ? year : null,
    minPlayers: players.min,
    maxPlayers: players.max,
    minDuration: duration.min,
    maxDuration: duration.max,
    minAge: parseRange(entry['Age(s)']).min,
    categories: toStringArray(entry['Catégorie(s)']),
    mechanics: toStringArray(entry['Mécanisme(s)']),
    rating: typeof entry['Note moyenne'] === 'number' ? entry['Note moyenne'] : null,
  };
}

/** Parses the raw JSON text of a MyLudo collection export. Throws on invalid input. */
export function parseMyLudoExport(json: string): MyLudoParseResult {
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error('MyLudo export must be a JSON array');
  const games: ImportedGame[] = [];
  let skipped = 0;
  for (const entry of data) {
    const game = entry && typeof entry === 'object' ? parseMyLudoEntry(entry) : null;
    if (game) games.push(game);
    else skipped++;
  }
  return { games, skipped };
}
