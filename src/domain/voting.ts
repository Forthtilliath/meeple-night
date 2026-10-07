import type { Game } from '../db/schema.js';

export interface CandidateFilter {
  players?: number | null;
  minDuration?: number | null;
  maxDuration?: number | null;
}

/**
 * A game fits if the player count is within its range and its duration range overlaps the
 * wanted one. Unknown bounds never exclude a game.
 */
export function fitsFilter(
  game: Game,
  { players, minDuration, maxDuration }: CandidateFilter,
): boolean {
  if (players) {
    if (game.minPlayers !== null && players < game.minPlayers) return false;
    if (game.maxPlayers !== null && players > game.maxPlayers) return false;
  }
  if (maxDuration && game.minDuration !== null && game.minDuration > maxDuration) return false;
  const longest = game.maxDuration ?? game.minDuration;
  if (minDuration && longest !== null && longest < minDuration) return false;
  return true;
}

/** Picks up to `count` random games matching the filter (Fisher-Yates on a copy). */
export function pickCandidates(
  games: Game[],
  filter: CandidateFilter,
  count: number,
  random: () => number = Math.random,
): Game[] {
  const pool = games.filter((game) => fitsFilter(game, filter));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j] as Game, pool[i] as Game];
  }
  return pool.slice(0, count);
}

export interface Vote {
  userId: string;
  gameId: number;
}

export interface TallyEntry {
  gameId: number;
  votes: number;
}

/** Counts approvals per option, most voted first; options without votes are kept. */
export function tally(optionIds: number[], votes: Vote[]): TallyEntry[] {
  const counts = new Map(optionIds.map((id) => [id, 0]));
  for (const vote of votes) {
    const current = counts.get(vote.gameId);
    if (current !== undefined) counts.set(vote.gameId, current + 1);
  }
  return [...counts]
    .map(([gameId, votes]) => ({ gameId, votes }))
    .sort((a, b) => b.votes - a.votes);
}

/** All options sharing the highest (non-zero) vote count. */
export function winners(results: TallyEntry[]): number[] {
  const best = results[0]?.votes ?? 0;
  if (best === 0) return [];
  return results.filter((r) => r.votes === best).map((r) => r.gameId);
}

/** The single winner of a vote: ties are broken at random. Null when nobody voted. */
export function pickWinner(results: TallyEntry[], random: () => number = Math.random) {
  const tied = winners(results);
  return tied[Math.floor(random() * tied.length)] ?? null;
}
