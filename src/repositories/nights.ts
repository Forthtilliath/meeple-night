import { and, asc, eq, gt, lte, ne } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { type GameNight, gameNights, type Rsvp, type RsvpStatus, rsvps } from '../db/schema.js';
import type { ReminderKind } from '../domain/reminders.js';

export interface NewNight {
  guildId: string;
  channelId: string;
  title: string;
  location: string | null;
  startsAt: Date;
  maxPlayers: number | null;
  createdBy: string;
}

export function createNight(db: Db, night: NewNight): GameNight {
  return db.insert(gameNights).values(night).returning().get();
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
