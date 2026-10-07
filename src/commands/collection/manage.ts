import { MessageFlags } from 'discord.js';
import { isManager } from '../../bot/permissions.js';
import type { BotContext, ChatInput } from '../../bot/types.js';
import { t } from '../../i18n/index.js';
import { addGame, archiveGame, getGame } from '../../repositories/games.js';
import { getSettings } from '../../repositories/guilds.js';
import { plain } from '../../ui/text.js';

async function allowed(interaction: ChatInput, { db, timezone }: BotContext): Promise<boolean> {
  const { organizerRoleId } = getSettings(db, interaction.guildId, timezone);
  if (isManager(interaction, organizerRoleId)) return true;
  await interaction.reply({
    content: t(interaction.locale).common.noPermission,
    flags: MessageFlags.Ephemeral,
  });
  return false;
}

export async function addGameCommand(interaction: ChatInput, ctx: BotContext): Promise<void> {
  if (!(await allowed(interaction, ctx))) return;
  const m = t(interaction.locale).collection;
  const options = interaction.options;
  const minPlayers = options.getInteger('min_players');
  const maxPlayers = options.getInteger('max_players');
  if (minPlayers !== null && maxPlayers !== null && minPlayers > maxPlayers) {
    await interaction.reply({ content: m.invalidRange, flags: MessageFlags.Ephemeral });
    return;
  }
  const duration = options.getInteger('duration');
  const game = addGame(ctx.db, interaction.guildId, {
    title: options.getString('title', true).trim(),
    minPlayers,
    maxPlayers: maxPlayers ?? minPlayers,
    minDuration: duration,
    maxDuration: duration,
  });
  await interaction.reply({
    content: game ? m.added(plain(game.title)) : m.duplicate,
    flags: MessageFlags.Ephemeral,
  });
}

export async function removeGameCommand(interaction: ChatInput, ctx: BotContext): Promise<void> {
  if (!(await allowed(interaction, ctx))) return;
  const m = t(interaction.locale);
  const game = getGame(ctx.db, interaction.guildId, interaction.options.getInteger('game', true));
  if (!game || !archiveGame(ctx.db, interaction.guildId, game.id)) {
    await interaction.reply({ content: m.common.gameNotFound, flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.reply({
    content: m.collection.removed(plain(game.title)),
    flags: MessageFlags.Ephemeral,
  });
}
