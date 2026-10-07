import { EmbedBuilder, MessageFlags, type ModalSubmitInteraction } from 'discord.js';
import { isManager } from '../../bot/permissions.js';
import type { BotContext, ChatInput } from '../../bot/types.js';
import type { Game } from '../../db/schema.js';
import { computeRatings, eloDeltas, INITIAL_RATING } from '../../domain/elo.js';
import { t } from '../../i18n/index.js';
import { getSettings } from '../../repositories/guilds.js';
import { type PlayerResult, playHistory, recordPlay } from '../../repositories/plays.js';
import { plain } from '../../ui/text.js';

export type PlayInteraction = ChatInput | ModalSubmitInteraction<'cached'>;

/**
 * Records a play and posts the Elo changes. Only a participant or an organizer may record it,
 * so nobody can rig the ranking of others.
 */
export async function savePlay(
  interaction: PlayInteraction,
  { db, timezone }: BotContext,
  game: Game,
  players: PlayerResult[],
  nightId: number | null = null,
): Promise<void> {
  const m = t(interaction.locale);
  const { organizerRoleId } = getSettings(db, interaction.guildId, timezone);
  const playing = players.some((p) => p.userId === interaction.user.id);
  if (!playing && !isManager(interaction, organizerRoleId)) {
    await interaction.reply({ content: m.play.notInPlay, flags: MessageFlags.Ephemeral });
    return;
  }

  const before = computeRatings(playHistory(db, interaction.guildId), game.id);
  const deltas = eloDeltas(players, before);
  const playId = recordPlay(db, {
    guildId: interaction.guildId,
    gameId: game.id,
    playedAt: new Date(),
    recordedBy: interaction.user.id,
    players,
    nightId,
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
    .setDescription([m.play.recorded(plain(game.title)), '', ...lines].join('\n'))
    .setFooter({ text: m.play.footer(playId) });
  await interaction.reply({ embeds: [embed], allowedMentions: { users: [] } });
}
