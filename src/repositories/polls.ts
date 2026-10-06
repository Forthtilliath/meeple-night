import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { type Game, games, type Poll, pollOptions, polls, pollVotes } from '../db/schema.js';
import type { Vote } from '../domain/voting.js';

export interface NewPoll {
  guildId: string;
  channelId: string;
  nightId: number | null;
  players: number | null;
  createdBy: string;
  gameIds: number[];
}

export function createPoll(db: Db, { gameIds, ...poll }: NewPoll): Poll {
  return db.transaction((tx) => {
    const created = tx.insert(polls).values(poll).returning().get();
    tx.insert(pollOptions)
      .values(gameIds.map((gameId) => ({ pollId: created.id, gameId })))
      .run();
    return created;
  });
}

export function setPollMessage(db: Db, pollId: number, messageId: string): void {
  db.update(polls).set({ messageId }).where(eq(polls.id, pollId)).run();
}

export function getPoll(db: Db, pollId: number): Poll | undefined {
  return db.select().from(polls).where(eq(polls.id, pollId)).get();
}

export function getPollGames(db: Db, pollId: number): Game[] {
  return db
    .select({ game: games })
    .from(pollOptions)
    .innerJoin(games, eq(games.id, pollOptions.gameId))
    .where(eq(pollOptions.pollId, pollId))
    .orderBy(asc(games.title))
    .all()
    .map((row) => row.game);
}

/** Replaces all the approvals of a user on a poll. */
export function setVotes(db: Db, pollId: number, userId: string, gameIds: number[]): void {
  db.transaction((tx) => {
    tx.delete(pollVotes)
      .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId)))
      .run();
    if (gameIds.length > 0) {
      tx.insert(pollVotes)
        .values(gameIds.map((gameId) => ({ pollId, userId, gameId })))
        .run();
    }
  });
}

export function getVotes(db: Db, pollId: number): Vote[] {
  return db
    .select({ userId: pollVotes.userId, gameId: pollVotes.gameId })
    .from(pollVotes)
    .where(eq(pollVotes.pollId, pollId))
    .all();
}

export function closePoll(db: Db, pollId: number): void {
  db.update(polls).set({ status: 'closed' }).where(eq(polls.id, pollId)).run();
}
