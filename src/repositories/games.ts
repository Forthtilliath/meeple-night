import { and, asc, eq, inArray, isNotNull, like, not, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { type Game, games } from '../db/schema.js';
import type { ImportedGame } from '../domain/myludo.js';

export interface ImportSummary {
  created: number;
  updated: number;
  /** Games removed because they are no longer in the export (sync mode only). */
  archived: number;
}

export interface ListOptions {
  /** Archived games are hidden, except where history matters (leaderboard). */
  includeArchived?: boolean;
}

const active = (includeArchived = false) =>
  includeArchived ? undefined : eq(games.archived, false);

/**
 * Inserts or refreshes games, matched on their MyLudo id, in a single transaction. A game
 * present in the export is restored if it was archived. With `sync`, MyLudo games missing
 * from the export are archived (manual games are left alone).
 */
export function importGames(
  db: Db,
  guildId: string,
  imported: ImportedGame[],
  { sync = false } = {},
): ImportSummary {
  return db.transaction((tx) => {
    const existing = new Set(
      tx
        .select({ myludoId: games.myludoId })
        .from(games)
        .where(eq(games.guildId, guildId))
        .all()
        .map((g) => g.myludoId),
    );
    let created = 0;
    for (const game of imported) {
      if (game.myludoId === null || game.myludoId === undefined || !existing.has(game.myludoId)) {
        created++;
      }
      tx.insert(games)
        .values({ ...game, guildId })
        .onConflictDoUpdate({
          target: [games.guildId, games.myludoId],
          set: { ...game, archived: false },
        })
        .run();
    }

    let archived = 0;
    if (sync) {
      const kept = imported.flatMap((g) => (typeof g.myludoId === 'number' ? [g.myludoId] : []));
      archived = tx
        .update(games)
        .set({ archived: true })
        .where(
          and(
            eq(games.guildId, guildId),
            eq(games.archived, false),
            isNotNull(games.myludoId),
            kept.length > 0 ? not(inArray(games.myludoId, kept)) : undefined,
          ),
        )
        .run().changes;
    }
    return { created, updated: imported.length - created, archived };
  });
}

export interface ManualGame {
  title: string;
  minPlayers: number | null;
  maxPlayers: number | null;
  minDuration: number | null;
  maxDuration: number | null;
}

/** Adds a game by hand. Restores an archived game of the same title; null if it already exists. */
export function addGame(db: Db, guildId: string, game: ManualGame): Game | null {
  const same = db
    .select()
    .from(games)
    .where(and(eq(games.guildId, guildId), sql`lower(${games.title}) = lower(${game.title})`))
    .get();
  if (same && !same.archived) return null;
  if (same) {
    return db
      .update(games)
      .set({ ...game, archived: false })
      .where(eq(games.id, same.id))
      .returning()
      .get() as Game;
  }
  return db
    .insert(games)
    .values({ ...game, guildId })
    .returning()
    .get();
}

/** Hides a game from the collection while keeping its plays and ratings. */
export function archiveGame(db: Db, guildId: string, id: number): boolean {
  return (
    db
      .update(games)
      .set({ archived: true })
      .where(and(eq(games.guildId, guildId), eq(games.id, id), eq(games.archived, false)))
      .run().changes > 0
  );
}

export function listGames(db: Db, guildId: string, { includeArchived }: ListOptions = {}): Game[] {
  return db
    .select()
    .from(games)
    .where(and(eq(games.guildId, guildId), active(includeArchived)))
    .orderBy(asc(games.title))
    .all();
}

/** Any game of the guild, archived or not (ids come from history or autocomplete). */
export function getGame(db: Db, guildId: string, id: number): Game | undefined {
  return db
    .select()
    .from(games)
    .where(and(eq(games.guildId, guildId), eq(games.id, id)))
    .get();
}

/** Case-insensitive title search, for autocomplete. */
export function searchGames(
  db: Db,
  guildId: string,
  query: string,
  limit = 25,
  { includeArchived }: ListOptions = {},
): Game[] {
  const escaped = query.replace(/[\\%_]/g, (c) => `\\${c}`);
  return db
    .select()
    .from(games)
    .where(
      and(
        eq(games.guildId, guildId),
        active(includeArchived),
        like(games.title, sql`${`%${escaped}%`} escape '\\'`),
      ),
    )
    .orderBy(asc(games.title))
    .limit(limit)
    .all();
}
