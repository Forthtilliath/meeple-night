import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../bot/types.js';
import { localize, lt, t } from '../i18n/index.js';

export const ping: Command = {
  data: localize(
    new SlashCommandBuilder(),
    lt('ping', 'Check that the bot is online', 'ping', 'Vérifier que le bot répond'),
  ),

  async execute(interaction, { client }) {
    await interaction.reply({
      content: t(interaction.locale).ping(Math.round(client.ws.ping)),
      flags: MessageFlags.Ephemeral,
    });
  },
};
