import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { games, playPlayers, plays } from '../db/schema.js';
import type { RatedPlay } from '../domain/elo.js';

export interface PlayerResult {
  userId: string;
  rank: number;
  score: number | null;
}

export interface NewPlay {
  guildId: string;
  gameId: number;
  playedAt: Date;
  recordedBy: string;
  players: PlayerResult[];
  nightId?: number | null;
}

export interface PlaySummary {
  id: number;
  gameId: number;
  gameTitle: string;
  playedAt: Date;
  recordedBy: string;
  /** Sorted by rank. */
  players: PlayerResult[];
}

export interface PlayFilter {
  gameId?: number | null;
  userId?: string | null;
}

/** Latest plays of a guild, newest first, optionally for one game and/or one player. */
export function recentPlays(
  db: Db,
  guildId: string,
  { gameId, userId }: PlayFilter = {},
  limit = 10,
): PlaySummary[] {
  const withPlayer = userId
    ? inArray(
        plays.id,
        db
          .select({ id: playPlayers.playId })
          .from(playPlayers)
          .where(eq(playPlayers.userId, userId)),
      )
    : undefined;
  const rows = db
    .select({
      id: plays.id,
      gameId: plays.gameId,
      gameTitle: games.title,
      playedAt: plays.playedAt,
      recordedBy: plays.recordedBy,
    })
    .from(plays)
    .innerJoin(games, eq(games.id, plays.gameId))
    .where(
      and(eq(plays.guildId, guildId), gameId ? eq(plays.gameId, gameId) : undefined, withPlayer),
    )
    .orderBy(desc(plays.playedAt), desc(plays.id))
    .limit(limit)
    .all();
  if (rows.length === 0) return [];
  const placements = db
    .select()
    .from(playPlayers)
    .where(
      inArray(
        playPlayers.playId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(playPlayers.rank))
    .all();
  return rows.map((row) => ({
    ...row,
    players: placements
      .filter((p) => p.playId === row.id)
      .map(({ userId, rank, score }) => ({ userId, rank, score })),
  }));
}

export function getPlay(db: Db, guildId: string, playId: number) {
  return db
    .select()
    .from(plays)
    .where(and(eq(plays.guildId, guildId), eq(plays.id, playId)))
    .get();
}

/** Deletes a play; its placements go with it, and ratings are recomputed from history. */
export function deletePlay(db: Db, guildId: string, playId: number): boolean {
  return (
    db
      .delete(plays)
      .where(and(eq(plays.guildId, guildId), eq(plays.id, playId)))
      .run().changes > 0
  );
}

export function recordPlay(db: Db, { players, ...play }: NewPlay): number {
  return db.transaction((tx) => {
    const { id } = tx.insert(plays).values(play).returning({ id: plays.id }).get();
    tx.insert(playPlayers)
      .values(players.map((p) => ({ ...p, playId: id })))
      .run();
    return id;
  });
}

export function countPlays(db: Db, guildId: string, gameId: number): number {
  const row = db
    .select({ total: count() })
    .from(plays)
    .where(and(eq(plays.guildId, guildId), eq(plays.gameId, gameId)))
    .get();
  return row?.total ?? 0;
}

export interface PlayHistory extends RatedPlay {
  playId: number;
}

/** Every play of a guild in chronological order, ready to be replayed by the Elo engine. */
export function playHistory(db: Db, guildId: string): PlayHistory[] {
  const rows = db
    .select({
      playId: plays.id,
      gameId: plays.gameId,
      userId: playPlayers.userId,
      rank: playPlayers.rank,
    })
    .from(plays)
    .innerJoin(playPlayers, eq(playPlayers.playId, plays.id))
    .where(eq(plays.guildId, guildId))
    .orderBy(asc(plays.playedAt), asc(plays.id))
    .all();

  const history: PlayHistory[] = [];
  for (const row of rows) {
    let play = history.at(-1);
    if (play?.playId !== row.playId) {
      play = { playId: row.playId, gameId: row.gameId, placements: [] };
      history.push(play);
    }
    play.placements.push({ userId: row.userId, rank: row.rank });
  }
  return history;
}
