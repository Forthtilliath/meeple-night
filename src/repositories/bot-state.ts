import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { botState } from '../db/schema.js';

export function getState(db: Db, key: string): string | null {
  return db.select().from(botState).where(eq(botState.key, key)).get()?.value ?? null;
}

export function setState(db: Db, key: string, value: string): void {
  db.insert(botState)
    .values({ key, value })
    .onConflictDoUpdate({ target: botState.key, set: { value } })
    .run();
}

/** Date stored as epoch milliseconds, or null if never set. */
export function getDateState(db: Db, key: string): Date | null {
  const value = getState(db, key);
  return value === null ? null : new Date(Number(value));
}

export function setDateState(db: Db, key: string, date: Date): void {
  setState(db, key, String(date.getTime()));
}
