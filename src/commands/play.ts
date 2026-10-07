import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../bot/types.js';
import { computeRatings, eloDeltas, INITIAL_RATING, ranksFromScores } from '../domain/elo.js';
import { localize, lt, t } from '../i18n/index.js';
import { getGame } from '../repositories/games.js';
import { playHistory, recordPlay } from '../repositories/plays.js';
import { plain } from '../ui/text.js';
import { autocompleteGame } from './autocomplete.js';

const MAX_PLAYERS = 8;

const data = localize(
  new SlashCommandBuilder(),
  lt('play', 'Track the games you played', 'partie', 'Suivre les parties jouées'),
)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) => {
    localize(
      sub,
      lt(
        'record',
        'Record a play, players in finishing order',
        'enregistrer',
        "Enregistrer une partie, joueurs dans l'ordre d'arrivée",
      ),
    ).addIntegerOption((o) =>
      localize(o, lt('game', 'Game played', 'jeu', 'Jeu joué'))
        .setRequired(true)
        .setAutocomplete(true),
    );
    for (let i = 1; i <= MAX_PLAYERS; i++) {
      sub.addUserOption((o) =>
        localize(
          o,
          lt(
            `player${i}`,
            i === 1 ? 'Winner' : `Player ranked #${i}`,
            `joueur${i}`,
            i === 1 ? 'Gagnant' : `Joueur classé n°${i}`,
          ),
        ).setRequired(i <= 2),
      );
    }
    return sub.addStringOption((o) =>
      localize(
        o,
        lt(
          'scores',
          'Optional scores in player order, e.g. 52,47,47 (ranks follow scores)',
          'scores',
          "Scores optionnels dans l'ordre des joueurs, ex. 52,47,47",
        ),
      ),
    );
  });

export const play: Command = {
  data,

  async execute(interaction, { db }) {
    const m = t(interaction.locale);
    const game = getGame(db, interaction.guildId, interaction.options.getInteger('game', true));
    if (!game) {
      await interaction.reply({ content: m.common.gameNotFound, flags: MessageFlags.Ephemeral });
      return;
    }

    const userIds: string[] = [];
    for (let i = 1; i <= MAX_PLAYERS; i++) {
      const user = interaction.options.getUser(`player${i}`);
      if (user) userIds.push(user.id);
    }
    if (userIds.length < 2) {
      await interaction.reply({ content: m.play.needTwoPlayers, flags: MessageFlags.Ephemeral });
      return;
    }
    if (new Set(userIds).size !== userIds.length) {
      await interaction.reply({ content: m.play.duplicatePlayers, flags: MessageFlags.Ephemeral });
      return;
    }

    const scoresInput = interaction.options.getString('scores');
    let scores: number[] | null = null;
    if (scoresInput) {
      scores = scoresInput
        .split(/[,;\s]+/)
        .filter(Boolean)
        .map(Number);
      if (scores.length !== userIds.length || scores.some((s) => !Number.isInteger(s))) {
        await interaction.reply({
          content: m.play.scoresMismatch(userIds.length),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }
    const ranks = scores ? ranksFromScores(scores) : userIds.map((_, i) => i + 1);
    const players = userIds.map((userId, i) => ({
      userId,
      rank: ranks[i] ?? i + 1,
      score: scores?.[i] ?? null,
    }));

    const before = computeRatings(playHistory(db, interaction.guildId), game.id);
    const deltas = eloDeltas(players, before);
    recordPlay(db, {
      guildId: interaction.guildId,
      gameId: game.id,
      playedAt: new Date(),
      recordedBy: interaction.user.id,
      players,
    });

    const lines = [...players]
      .sort((a, b) => a.rank - b.rank)
      .map((p) => {
        const delta = deltas.get(p.userId) ?? 0;
        const rating = (before.get(p.userId) ?? INITIAL_RATING) + delta;
        const score = p.score !== null ? ` · ${p.score}` : '';
        return m.play.ratingLine(p.rank, `<@${p.userId}>${score}`, rating, delta);
      });
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription([m.play.recorded(plain(game.title)), '', ...lines].join('\n'));
    await interaction.reply({ embeds: [embed], allowedMentions: { users: [] } });
  },

  autocomplete: autocompleteGame,
};
