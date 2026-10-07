import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import {
  type GuildSettingsRow,
  gameNights,
  games,
  guildSettings,
  plays,
  polls,
} from '../db/schema.js';

export interface GuildSettings {
  timezone: string;
  organizerRoleId: string | null;
  reminderEarlyHours: number;
  reminderLateHours: number;
}

export type SettingsPatch = Partial<Omit<GuildSettingsRow, 'guildId'>>;

export const DEFAULT_REMINDER_HOURS = { early: 24, late: 2 } as const;
/** Upper bound of the first reminder, which also sizes the reminder loop's lookahead. */
export const MAX_REMINDER_HOURS = 168;

/** Settings of a guild, with defaults for anything it never configured. */
export function getSettings(db: Db, guildId: string, defaultTimezone: string): GuildSettings {
  const row = db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).get();
  return {
    timezone: row?.timezone ?? defaultTimezone,
    organizerRoleId: row?.organizerRoleId ?? null,
    reminderEarlyHours: row?.reminderEarlyHours ?? DEFAULT_REMINDER_HOURS.early,
    reminderLateHours: row?.reminderLateHours ?? DEFAULT_REMINDER_HOURS.late,
  };
}

/** Deletes everything stored for a guild (children rows go with their parents by cascade). */
export function purgeGuild(db: Db, guildId: string): void {
  db.transaction((tx) => {
    tx.delete(polls).where(eq(polls.guildId, guildId)).run();
    tx.delete(plays).where(eq(plays.guildId, guildId)).run();
    tx.delete(gameNights).where(eq(gameNights.guildId, guildId)).run();
    tx.delete(games).where(eq(games.guildId, guildId)).run();
    tx.delete(guildSettings).where(eq(guildSettings.guildId, guildId)).run();
  });
}

export function updateSettings(db: Db, guildId: string, patch: SettingsPatch): void {
  db.insert(guildSettings)
    .values({ guildId, ...patch })
    .onConflictDoUpdate({ target: guildSettings.guildId, set: patch })
    .run();
}
