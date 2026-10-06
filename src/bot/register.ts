import { REST, Routes } from 'discord.js';
import type { Config } from '../config.js';
import type { Command } from './types.js';

/**
 * Overwrites the application's slash commands. Guild commands update instantly (handy in
 * development); global ones can take a while to show up in clients.
 */
export async function registerCommands(config: Config, commands: Command[]): Promise<void> {
  const rest = new REST().setToken(config.token);
  const body = commands.map((c) => c.data.toJSON());
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);
  await rest.put(route, { body });
  console.log(
    `Registered ${body.length} commands ${config.guildId ? 'on the dev guild' : 'globally'}`,
  );
}
