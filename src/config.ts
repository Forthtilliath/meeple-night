import { isValidTimezone } from './domain/dates.js';

export interface Config {
  token: string;
  clientId: string;
  guildId: string | null;
  databasePath: string;
  timezone: string;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const timezone = env.TIMEZONE?.trim() || 'Europe/Paris';
  if (!isValidTimezone(timezone)) {
    throw new Error(`Invalid TIMEZONE "${timezone}" (expected an IANA name like Europe/Paris)`);
  }
  return {
    token: required(env, 'DISCORD_TOKEN'),
    clientId: required(env, 'DISCORD_CLIENT_ID'),
    guildId: env.DISCORD_GUILD_ID?.trim() || null,
    databasePath: env.DATABASE_PATH?.trim() || './data/bot.db',
    timezone,
  };
}
