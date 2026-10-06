import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../bot/types.js';
import { standings } from '../domain/elo.js';
import { localize, lt, t } from '../i18n/index.js';
import { getGame } from '../repositories/games.js';
import { playHistory } from '../repositories/plays.js';
import { autocompleteGame } from './autocomplete.js';

const TOP = 15;

const data = localize(
  new SlashCommandBuilder(),
  lt('leaderboard', 'Elo ranking of the group', 'classement', 'Classement Elo du groupe'),
)
  .setContexts(InteractionContextType.Guild)
  .addIntegerOption((o) =>
    localize(o, lt('game', 'Only this game', 'jeu', 'Seulement ce jeu')).setAutocomplete(true),
  );

export const leaderboard: Command = {
  data,

  async execute(interaction, { db }) {
    const m = t(interaction.locale);
    const gameId = interaction.options.getInteger('game') ?? undefined;
    const game = gameId === undefined ? undefined : getGame(db, interaction.guildId, gameId);
    if (gameId !== undefined && !game) {
      await interaction.reply({ content: m.common.gameNotFound, flags: MessageFlags.Ephemeral });
      return;
    }

    const ranking = standings(playHistory(db, interaction.guildId), gameId);
    if (ranking.length === 0) {
      await interaction.reply({ content: m.leaderboard.empty, flags: MessageFlags.Ephemeral });
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    const lines = ranking
      .slice(0, TOP)
      .map((s, i) =>
        m.leaderboard.line(i + 1, `${medals[i] ?? ''} <@${s.userId}>`.trim(), s.rating, s.plays),
      );
    const embed = new EmbedBuilder()
      .setColor(0xeb459e)
      .setTitle(game ? m.leaderboard.titleGame(game.title) : m.leaderboard.titleOverall)
      .setDescription(lines.join('\n'));
    await interaction.reply({ embeds: [embed], allowedMentions: { users: [] } });
  },

  autocomplete: autocompleteGame,
};
