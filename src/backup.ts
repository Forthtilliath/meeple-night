import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from './db/client.js';
import { log } from './log.js';

const FILE = /^bot-\d{4}-\d{2}-\d{2}\.db$/;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Writes today's consistent copy of the database (SQLite online backup, safe while the bot
 * writes) and keeps only the `keep` latest ones. Does nothing if today's copy exists.
 * Returns the path written, if any.
 */
export async function backupDatabase(
  db: Db,
  dir: string,
  keep: number,
  now = new Date(),
): Promise<string | null> {
  mkdirSync(dir, { recursive: true });
  const target = join(dir, `bot-${now.toISOString().slice(0, 10)}.db`);
  if (existsSync(target)) return null;
  await db.$client.backup(target);
  const copies = readdirSync(dir)
    .filter((name) => FILE.test(name))
    .sort();
  for (const old of copies.slice(0, Math.max(0, copies.length - keep))) {
    unlinkSync(join(dir, old));
  }
  return target;
}

/** Backs up at startup, then checks every 6 hours whether a new day needs its copy. */
export function startBackups(db: Db, dir: string, keep: number): () => void {
  const run = () => {
    backupDatabase(db, dir, keep)
      .then((path) => path && log.info('Database backed up', { path }))
      .catch((error) => log.error('Database backup failed', { error }));
  };
  run();
  const timer = setInterval(run, CHECK_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
