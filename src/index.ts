import { dirname } from 'node:path';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { startBackups } from './backup.js';
import { registerCommands } from './bot/register.js';
import { createRouter } from './bot/router.js';
import type { BotContext } from './bot/types.js';
import { commands, componentHandlers, modalHandlers } from './commands/index.js';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { startHealthServer, startWatchdog } from './health.js';
import { log } from './log.js';
import { dropPrivileges } from './privileges.js';
import { confirmRenewal, isRenewalButton, startRenewalReminder } from './renewal.js';
import { purgeGuild } from './repositories/guilds.js';
import { startScheduler } from './scheduler/index.js';

const config = loadConfig();
// Before anything touches the disk or the network.
dropPrivileges(dirname(config.databasePath));
const db = createDb(config.databasePath);

// Slash commands and components only: no privileged intent (message content, members) needed.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const ctx: BotContext = { client, db, timezone: config.timezone };

// Without an 'error' listener, an emitted error would crash the process.
client.on(Events.Error, (error) => log.error('Client error', { error }));
client.on(Events.Warn, (message) => log.warn('Client warning', { message }));
process.on('unhandledRejection', (error) => log.error('Unhandled rejection', { error }));

const route = createRouter(commands, componentHandlers, ctx, modalHandlers);
const renewal = config.renewal;
client.on(Events.InteractionCreate, (interaction) =>
  renewal && isRenewalButton(interaction)
    ? confirmRenewal(interaction, ctx, renewal).catch((error) =>
        log.error('Renewal confirmation failed', { error }),
      )
    : route(interaction),
);

// Fired when the bot is kicked or the server is deleted (outages emit GuildUnavailable instead).
client.on(Events.GuildDelete, (guild) => {
  purgeGuild(db, guild.id);
  log.info('Left guild, data purged', { guildId: guild.id });
});

const stopScheduler = startScheduler(ctx);
const stopBackups = config.backupDir
  ? startBackups(db, config.backupDir, config.backupKeep)
  : () => undefined;
const stopRenewal = renewal ? startRenewalReminder(ctx, renewal) : () => undefined;
const health = config.healthPort ? startHealthServer(client, config.healthPort) : null;
const stopWatchdog = startWatchdog(client);

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
  stopBackups();
  stopRenewal();
  stopWatchdog();
  health?.close();
  await client.destroy();
  db.$client.close();
  process.exit(0);
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

await client.login(config.token);
