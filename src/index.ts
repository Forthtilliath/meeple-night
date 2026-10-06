import { Client, Events, GatewayIntentBits } from 'discord.js';
import { registerCommands } from './bot/register.js';
import { createRouter } from './bot/router.js';
import type { BotContext } from './bot/types.js';
import { commands, componentHandlers } from './commands/index.js';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { startReminderLoop } from './scheduler/reminders.js';

const config = loadConfig();
const db = createDb(config.databasePath);

// Slash commands and components only: no privileged intent (message content, members) needed.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const ctx: BotContext = { client, db, timezone: config.timezone };

client.on(Events.InteractionCreate, createRouter(commands, componentHandlers, ctx));

client.once(Events.ClientReady, async (ready) => {
  console.log(`Logged in as ${ready.user.tag}`);
  await registerCommands(config, commands);
  const stopReminders = startReminderLoop(ctx);

  const shutdown = async () => {
    stopReminders();
    await client.destroy();
    db.$client.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
});

await client.login(config.token);
