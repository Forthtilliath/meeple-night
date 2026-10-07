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
  /** Direct message reminding to renew a free hosting plan; null disables it. */
  renewal: RenewalConfig | null;
}

export interface RenewalConfig {
  userId: string;
  /** Days a renewal lasts. */
  days: number;
  /** Hosting panel opened by the reminder's link button. */
  url: string | null;
  locale: string;
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

function renewal(env: NodeJS.ProcessEnv): RenewalConfig | null {
  const userId = env.RENEWAL_USER_ID?.trim();
  if (!userId) return null;
  if (!/^\d{17,20}$/.test(userId)) {
    throw new Error(`Invalid RENEWAL_USER_ID "${userId}" (expected a Discord user id)`);
  }
  // The first reminder comes a day before the deadline: shorter plans would be nagged at once.
  const days = integer(env, 'RENEWAL_DAYS', 4);
  if (days < 2) throw new Error(`Invalid RENEWAL_DAYS "${days}" (expected at least 2)`);
  const url = env.RENEWAL_URL?.trim() || null;
  if (url && !/^https?:\/\//.test(url)) {
    throw new Error(`Invalid RENEWAL_URL "${url}" (expected an http(s) link)`);
  }
  return { userId, days, url, locale: env.RENEWAL_LOCALE?.trim() || 'en' };
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
    renewal: renewal(env),
  };
}
