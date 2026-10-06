export const INITIAL_RATING = 1000;
export const K_FACTOR = 32;

export interface Placement {
  userId: string;
  /** 1 = winner. Equal ranks are ties. */
  rank: number;
}

export interface RatedPlay {
  gameId: number;
  placements: Placement[];
}

export type Ratings = Map<string, number>;

function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

/**
 * Multiplayer Elo: each play is treated as a set of pairwise duels between all players.
 * The K factor is divided by (n - 1) so a play weighs the same whatever the player count.
 * Returns the rating change of each player.
 */
export function eloDeltas(
  placements: Placement[],
  ratings: Ratings,
  k = K_FACTOR,
): Map<string, number> {
  const deltas = new Map<string, number>();
  const n = placements.length;
  if (n < 2) return deltas;
  const weight = k / (n - 1);
  for (const player of placements) {
    const rating = ratings.get(player.userId) ?? INITIAL_RATING;
    let delta = 0;
    for (const opponent of placements) {
      if (opponent === player) continue;
      const opponentRating = ratings.get(opponent.userId) ?? INITIAL_RATING;
      const actual = player.rank < opponent.rank ? 1 : player.rank === opponent.rank ? 0.5 : 0;
      delta += weight * (actual - expectedScore(rating, opponentRating));
    }
    deltas.set(player.userId, delta);
  }
  return deltas;
}

export function applyPlay(ratings: Ratings, placements: Placement[]): Map<string, number> {
  const deltas = eloDeltas(placements, ratings);
  for (const [userId, delta] of deltas) {
    ratings.set(userId, (ratings.get(userId) ?? INITIAL_RATING) + delta);
  }
  return deltas;
}

/**
 * Replays the full history (chronological order) to get current ratings.
 * Computing from history keeps ratings consistent if a play is edited or deleted.
 */
export function computeRatings(history: RatedPlay[], gameId?: number): Ratings {
  const ratings: Ratings = new Map();
  for (const play of history) {
    if (gameId === undefined || play.gameId === gameId) applyPlay(ratings, play.placements);
  }
  return ratings;
}

export interface Standing {
  userId: string;
  rating: number;
  plays: number;
}

/** Ratings sorted best first, with each player's number of plays. */
export function standings(history: RatedPlay[], gameId?: number): Standing[] {
  const ratings = computeRatings(history, gameId);
  const plays = new Map<string, number>();
  for (const play of history) {
    if (gameId !== undefined && play.gameId !== gameId) continue;
    for (const { userId } of play.placements) plays.set(userId, (plays.get(userId) ?? 0) + 1);
  }
  return [...ratings]
    .map(([userId, rating]) => ({ userId, rating, plays: plays.get(userId) ?? 0 }))
    .sort((a, b) => b.rating - a.rating);
}

/** Converts a list of scores (same order as players) into ranks; higher score is better. */
export function ranksFromScores(scores: number[]): number[] {
  return scores.map((score) => 1 + scores.filter((other) => other > score).length);
}
