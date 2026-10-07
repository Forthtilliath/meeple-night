import { and, asc, count, desc, eq, gt, lte, ne } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import {
  type GameNight,
  gameNights,
  type Recurrence,
  type Rsvp,
  type RsvpStatus,
  rsvps,
} from '../db/schema.js';
import type { ReminderKind } from '../domain/reminders.js';

export interface NewNight {
  guildId: string;
  channelId: string;
  title: string;
  location: string | null;
  startsAt: Date;
  maxPlayers: number | null;
  createdBy: string;
  recurrence?: Recurrence | null;
}

export type NightPatch = Partial<
  Pick<
    GameNight,
    'title' | 'location' | 'startsAt' | 'maxPlayers' | 'gameId' | 'scheduledEventId' | 'recurrence'
  >
>;

export function createNight(db: Db, night: NewNight): GameNight {
  return db.insert(gameNights).values(night).returning().get();
}

/** Applies changes; a new date re-arms both reminders. */
export function updateNight(db: Db, nightId: number, patch: NightPatch): GameNight {
  const rearm = patch.startsAt ? { reminderDaySent: false, reminderHoursSent: false } : {};
  return db
    .update(gameNights)
    .set({ ...patch, ...rearm })
    .where(eq(gameNights.id, nightId))
    .returning()
    .get() as GameNight;
}

/** Upcoming nights a member organizes, to cap how many one person can open. */
export function countUpcomingNightsBy(db: Db, guildId: string, userId: string, now: Date) {
  const row = db
    .select({ total: count() })
    .from(gameNights)
    .where(
      and(
        eq(gameNights.guildId, guildId),
        eq(gameNights.createdBy, userId),
        eq(gameNights.status, 'scheduled'),
        gt(gameNights.startsAt, now),
      ),
    )
    .get();
  return row?.total ?? 0;
}

/** Nights (of every guild) that started and were not processed yet, cancelled ones included. */
export function nightsToStart(db: Db, now: Date): GameNight[] {
  return db
    .select()
    .from(gameNights)
    .where(and(eq(gameNights.startHandled, false), lte(gameNights.startsAt, now)))
    .all();
}

/**
 * Flags a started night and, for a recurring one, creates its next occurrence in the same
 * transaction: a crash can neither skip nor duplicate an occurrence.
 */
export function handleNightStart(
  db: Db,
  night: GameNight,
  nextStartsAt: Date | null,
): GameNight | null {
  return db.transaction((tx) => {
    tx.update(gameNights).set({ startHandled: true }).where(eq(gameNights.id, night.id)).run();
    if (!nextStartsAt || !night.recurrence) return null;
    return tx
      .insert(gameNights)
      .values({
        guildId: night.guildId,
        channelId: night.channelId,
        title: night.title,
        location: night.location,
        startsAt: nextStartsAt,
        maxPlayers: night.maxPlayers,
        createdBy: night.createdBy,
        recurrence: night.recurrence,
      })
      .returning()
      .get();
  });
}

/** Nights of a guild that started recently, e.g. to record the play of the evening. */
export function recentNights(db: Db, guildId: string, since: Date, until: Date): GameNight[] {
  return db
    .select()
    .from(gameNights)
    .where(
      and(
        eq(gameNights.guildId, guildId),
        eq(gameNights.status, 'scheduled'),
        gt(gameNights.startsAt, since),
        lte(gameNights.startsAt, until),
      ),
    )
    .orderBy(desc(gameNights.startsAt))
    .limit(25)
    .all();
}

export function setNightMessage(db: Db, nightId: number, messageId: string): void {
  db.update(gameNights).set({ messageId }).where(eq(gameNights.id, nightId)).run();
}

export function getNight(db: Db, guildId: string, nightId: number): GameNight | undefined {
  return db
    .select()
    .from(gameNights)
    .where(and(eq(gameNights.guildId, guildId), eq(gameNights.id, nightId)))
    .get();
}

export function upcomingNights(db: Db, guildId: string, now: Date, limit = 25): GameNight[] {
  return db
    .select()
    .from(gameNights)
    .where(
      and(
        eq(gameNights.guildId, guildId),
        eq(gameNights.status, 'scheduled'),
        gt(gameNights.startsAt, now),
      ),
    )
    .orderBy(asc(gameNights.startsAt))
    .limit(limit)
    .all();
}

/** Scheduled nights of every guild starting between now and `until`, for the reminder loop. */
export function nightsStartingBefore(db: Db, now: Date, until: Date): GameNight[] {
  return db
    .select()
    .from(gameNights)
    .where(
      and(
        eq(gameNights.status, 'scheduled'),
        gt(gameNights.startsAt, now),
        lte(gameNights.startsAt, until),
      ),
    )
    .all();
}

export function markReminderSent(db: Db, nightId: number, kind: ReminderKind): void {
  // The late reminder supersedes the early one, so both are flagged to never send it late.
  const flags =
    kind === 'early'
      ? { reminderDaySent: true }
      : { reminderDaySent: true, reminderHoursSent: true };
  db.update(gameNights).set(flags).where(eq(gameNights.id, nightId)).run();
}

export function cancelNight(db: Db, nightId: number): void {
  db.update(gameNights).set({ status: 'cancelled' }).where(eq(gameNights.id, nightId)).run();
}

/** Upserts an answer. Changing the answer resets its date (and so the waitlist position). */
export function setRsvp(
  db: Db,
  nightId: number,
  userId: string,
  status: RsvpStatus,
  now = new Date(),
): void {
  db.insert(rsvps)
    .values({ nightId, userId, status, updatedAt: now })
    .onConflictDoUpdate({
      target: [rsvps.nightId, rsvps.userId],
      set: { status, updatedAt: now },
      // Clicking the same button twice must not move the user to the end of the waitlist.
      setWhere: ne(rsvps.status, status),
    })
    .run();
}

export function getRsvps(db: Db, nightId: number): Rsvp[] {
  return db.select().from(rsvps).where(eq(rsvps.nightId, nightId)).all();
}
