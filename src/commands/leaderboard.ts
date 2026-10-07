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
import { autocompleteAnyGame } from './autocomplete.js';

const TOP = 15;
/** Ratings move a lot over the first plays: hide them by default to keep the top meaningful. */
export const DEFAULT_MIN_PLAYS = 3;

const data = localize(
  new SlashCommandBuilder(),
  lt('leaderboard', 'Elo ranking of the group', 'classement', 'Classement Elo du groupe'),
)
  .setContexts(InteractionContextType.Guild)
  .addIntegerOption((o) =>
    localize(o, lt('game', 'Only this game', 'jeu', 'Seulement ce jeu')).setAutocomplete(true),
  )
  .addIntegerOption((o) =>
    localize(
      o,
      lt(
        'min_plays',
        `Plays needed to be ranked (default ${DEFAULT_MIN_PLAYS})`,
        'parties_min',
        `Parties nécessaires pour être classé (${DEFAULT_MIN_PLAYS} par défaut)`,
      ),
    )
      .setMinValue(1)
      .setMaxValue(100),
  );

export const leaderboard: Command = {
  data,

  async execute(interaction, { db }) {
    const m = t(interaction.locale);
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });
    const gameId = interaction.options.getInteger('game') ?? undefined;
    const game = gameId === undefined ? undefined : getGame(db, interaction.guildId, gameId);
    if (gameId !== undefined && !game) {
      await reply(m.common.gameNotFound);
      return;
    }

    const all = standings(playHistory(db, interaction.guildId), gameId);
    if (all.length === 0) {
      await reply(m.leaderboard.empty);
      return;
    }
    const minPlays = interaction.options.getInteger('min_plays') ?? DEFAULT_MIN_PLAYS;
    const ranking = all.filter((s) => s.plays >= minPlays);
    if (ranking.length === 0) {
      await reply(m.leaderboard.notEnough(minPlays));
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
    const hidden = all.length - ranking.length;
    if (hidden > 0) embed.setFooter({ text: m.leaderboard.hidden(hidden, minPlays) });
    await interaction.reply({ embeds: [embed], allowedMentions: { users: [] } });
  },

  autocomplete: autocompleteAnyGame,
};
