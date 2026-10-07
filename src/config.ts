import { dirname, join } from 'node:path';
import { isValidTimezone } from './domain/dates.js';

export interface Config {
  token: string;
  clientId: string;
  guildId: string | null;
  databasePath: string;
  timezone: string;
  /** Folder of the daily SQLite copies; null disables backups. */
  backupDir: string | null;
  backupKeep: number;
  /** Port of the /health endpoint; null disables it. */
  healthPort: number | null;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return value;
}

function integer(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${name} "${raw}" (expected a positive integer)`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const timezone = env.TIMEZONE?.trim() || 'Europe/Paris';
  if (!isValidTimezone(timezone)) {
    throw new Error(`Invalid TIMEZONE "${timezone}" (expected an IANA name like Europe/Paris)`);
  }
  const databasePath = env.DATABASE_PATH?.trim() || './data/bot.db';
  const backupKeep = integer(env, 'BACKUP_KEEP', 7);
  const healthPort = integer(env, 'HEALTH_PORT', 0);
  return {
    token: required(env, 'DISCORD_TOKEN'),
    clientId: required(env, 'DISCORD_CLIENT_ID'),
    guildId: env.DISCORD_GUILD_ID?.trim() || null,
    databasePath,
    timezone,
    backupDir:
      backupKeep === 0 || databasePath === ':memory:'
        ? null
        : env.BACKUP_DIR?.trim() || join(dirname(databasePath), 'backups'),
    backupKeep,
    healthPort: healthPort || null,
  };
}
