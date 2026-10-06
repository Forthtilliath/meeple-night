import { and, asc, eq, like, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { type Game, games } from '../db/schema.js';
import type { ImportedGame } from '../domain/myludo.js';

export interface ImportSummary {
  created: number;
  updated: number;
}

/** Inserts or refreshes games, matched on their MyLudo id. Runs in a single transaction. */
export function importGames(db: Db, guildId: string, imported: ImportedGame[]): ImportSummary {
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
          set: { ...game },
        })
        .run();
    }
    return { created, updated: imported.length - created };
  });
}

export function listGames(db: Db, guildId: string): Game[] {
  return db.select().from(games).where(eq(games.guildId, guildId)).orderBy(asc(games.title)).all();
}

export function getGame(db: Db, guildId: string, id: number): Game | undefined {
  return db
    .select()
    .from(games)
    .where(and(eq(games.guildId, guildId), eq(games.id, id)))
    .get();
}

/** Case-insensitive title search, for autocomplete. */
export function searchGames(db: Db, guildId: string, query: string, limit = 25): Game[] {
  const escaped = query.replace(/[\\%_]/g, (c) => `\\${c}`);
  return db
    .select()
    .from(games)
    .where(and(eq(games.guildId, guildId), like(games.title, sql`${`%${escaped}%`} escape '\\'`)))
    .orderBy(asc(games.title))
    .limit(limit)
    .all();
}
