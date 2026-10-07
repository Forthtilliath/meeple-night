import { and, asc, count, eq, lte } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import {
  type Game,
  gameNights,
  games,
  type Poll,
  pollOptions,
  polls,
  pollVotes,
} from '../db/schema.js';
import { pickWinner, tally, type Vote } from '../domain/voting.js';

export interface NewPoll {
  guildId: string;
  channelId: string;
  nightId: number | null;
  players: number | null;
  createdBy: string;
  gameIds: number[];
  closesAt?: Date | null;
  attendeesOnly?: boolean;
}

/** Open polls started by a member, to cap how many one person can run. */
export function countOpenPollsBy(db: Db, guildId: string, userId: string): number {
  const row = db
    .select({ total: count() })
    .from(polls)
    .where(and(eq(polls.guildId, guildId), eq(polls.createdBy, userId), eq(polls.status, 'open')))
    .get();
  return row?.total ?? 0;
}

/** Open polls (of every guild) whose closing time has come. */
export function duePolls(db: Db, now: Date): Poll[] {
  return db
    .select()
    .from(polls)
    .where(and(eq(polls.status, 'open'), lte(polls.closesAt, now)))
    .all();
}

/**
 * Closes a poll: picks the winner (ties broken at random) and, for a poll linked to a night,
 * sets it as the night's game. Returns the closed poll.
 */
export function finalizePoll(db: Db, poll: Poll, random: () => number = Math.random): Poll {
  return db.transaction((tx) => {
    const optionIds = tx
      .select({ gameId: pollOptions.gameId })
      .from(pollOptions)
      .where(eq(pollOptions.pollId, poll.id))
      .all()
      .map((o) => o.gameId);
    const votes = tx
      .select({ userId: pollVotes.userId, gameId: pollVotes.gameId })
      .from(pollVotes)
      .where(eq(pollVotes.pollId, poll.id))
      .all();
    const winnerGameId = pickWinner(tally(optionIds, votes), random);
    tx.update(polls).set({ status: 'closed', winnerGameId }).where(eq(polls.id, poll.id)).run();
    if (poll.nightId && winnerGameId) {
      tx.update(gameNights)
        .set({ gameId: winnerGameId })
        .where(eq(gameNights.id, poll.nightId))
        .run();
    }
    return { ...poll, status: 'closed' as const, winnerGameId };
  });
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
