import { ranksFromScores } from './elo.js';

export interface Candidate {
  userId: string;
  /** Names the user may be typed as (display name, username…), matched case-insensitively. */
  names: string[];
}

export interface RankedPlayer {
  userId: string;
  rank: number;
  score: number | null;
}

export type RankingError =
  | { error: 'unknown'; name: string }
  | { error: 'duplicate'; name: string }
  | { error: 'tooFew' }
  | { error: 'partialScores' };

export type RankingResult = { players: RankedPlayer[] } | RankingError;

const NUMBERING = /^\d+\s*[.)-]\s+/;
const SCORE = /^(.*?)\s*[:=]\s*(-?\d+)\s*$/;

/**
 * Reads a finishing order typed one player per line, winner first, e.g. the text of the
 * "record from a night" form:
 *
 *     Alice : 52
 *     Bob : 47
 *
 * Numbering ("1. Alice") is ignored. Scores are optional but, when given, required for every
 * line; ranks then follow the scores (ties allowed).
 */
export function parseRanking(text: string, candidates: Candidate[]): RankingResult {
  const byName = new Map<string, string>();
  for (const { userId, names } of candidates) {
    for (const name of names) byName.set(name.trim().toLowerCase(), userId);
  }

  const entries: { userId: string; score: number | null }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(NUMBERING, '');
    if (!line) continue;
    // A name containing ":" wins over the score syntax.
    let name = line;
    let score: number | null = null;
    const match = SCORE.exec(line);
    if (!byName.has(line.toLowerCase()) && match) {
      name = match[1] ?? '';
      score = Number(match[2]);
    }
    const userId = byName.get(name.trim().toLowerCase());
    if (!userId) return { error: 'unknown', name };
    if (entries.some((e) => e.userId === userId)) return { error: 'duplicate', name };
    entries.push({ userId, score });
  }

  if (entries.length < 2) return { error: 'tooFew' };
  const scored = entries.filter((e) => e.score !== null).length;
  if (scored > 0 && scored < entries.length) return { error: 'partialScores' };
  const ranks =
    scored > 0 ? ranksFromScores(entries.map((e) => e.score ?? 0)) : entries.map((_, i) => i + 1);
  return {
    players: entries.map((e, i) => ({ userId: e.userId, rank: ranks[i] ?? i + 1, score: e.score })),
  };
}
