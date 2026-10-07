import { Client, Events, GatewayIntentBits } from 'discord.js';
import { registerCommands } from './bot/register.js';
import { createRouter } from './bot/router.js';
import type { BotContext } from './bot/types.js';
import { commands, componentHandlers, modalHandlers } from './commands/index.js';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { log } from './log.js';
import { purgeGuild } from './repositories/guilds.js';
import { startScheduler } from './scheduler/index.js';

const config = loadConfig();
const db = createDb(config.databasePath);

// Slash commands and components only: no privileged intent (message content, members) needed.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const ctx: BotContext = { client, db, timezone: config.timezone };

// Without an 'error' listener, an emitted error would crash the process.
client.on(Events.Error, (error) => log.error('Client error', { error }));
client.on(Events.Warn, (message) => log.warn('Client warning', { message }));
process.on('unhandledRejection', (error) => log.error('Unhandled rejection', { error }));

client.on(Events.InteractionCreate, createRouter(commands, componentHandlers, ctx, modalHandlers));

// Fired when the bot is kicked or the server is deleted (outages emit GuildUnavailable instead).
client.on(Events.GuildDelete, (guild) => {
  purgeGuild(db, guild.id);
  log.info('Left guild, data purged', { guildId: guild.id });
});

const stopScheduler = startScheduler(ctx);

client.once(Events.ClientReady, async (ready) => {
  log.info('Logged in', { user: ready.user.tag, guilds: ready.guilds.cache.size });
  // Commands registered by a previous run keep working: a failure here must not stop the bot.
  await registerCommands(config, commands).catch((error) =>
    log.error('Command registration failed', { error }),
  );
});

const shutdown = async (signal: string) => {
  log.info('Shutting down', { signal });
  stopScheduler();
  await client.destroy();
  db.$client.close();
  process.exit(0);
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

await client.login(config.token);
