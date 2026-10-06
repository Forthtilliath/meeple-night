import { and, asc, count, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { playPlayers, plays } from '../db/schema.js';
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
