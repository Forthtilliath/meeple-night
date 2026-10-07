import { EmbedBuilder, MessageFlags } from 'discord.js';
import { isManager } from '../../bot/permissions.js';
import type { BotContext, ChatInput } from '../../bot/types.js';
import { discordTimestamp } from '../../domain/dates.js';
import { t } from '../../i18n/index.js';
import { getSettings } from '../../repositories/guilds.js';
import { deletePlay, getPlay, recentPlays } from '../../repositories/plays.js';
import { plain } from '../../ui/text.js';

export async function playHistoryCommand(interaction: ChatInput, { db }: BotContext) {
  const m = t(interaction.locale).play;
  const plays = recentPlays(db, interaction.guildId, {
    gameId: interaction.options.getInteger('game'),
    userId: interaction.options.getUser('player')?.id,
  });
  if (plays.length === 0) {
    await interaction.reply({ content: m.historyEmpty, flags: MessageFlags.Ephemeral });
    return;
  }
  const lines = plays.map((play) =>
    m.historyLine(
      play.id,
      discordTimestamp(play.playedAt, 'd'),
      plain(play.gameTitle),
      play.players
        .map((p) => `${p.rank}. <@${p.userId}>${p.score !== null ? ` (${p.score})` : ''}`)
        .join(', '),
    ),
  );
  const embed = new EmbedBuilder().setTitle(m.historyTitle).setDescription(lines.join('\n'));
  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { users: [] },
  });
}

/** Deletes a mistaken play: its author or an organizer only. Ratings are derived, so that's all. */
export async function undoPlayCommand(interaction: ChatInput, { db, timezone }: BotContext) {
  const m = t(interaction.locale);
  const reply = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
  const play = getPlay(db, interaction.guildId, interaction.options.getInteger('play', true));
  if (!play) {
    await reply(m.play.notFound);
    return;
  }
  const { organizerRoleId } = getSettings(db, interaction.guildId, timezone);
  if (play.recordedBy !== interaction.user.id && !isManager(interaction, organizerRoleId)) {
    await reply(m.common.noPermission);
    return;
  }
  deletePlay(db, interaction.guildId, play.id);
  await interaction.reply({ content: m.play.undone(play.id) });
}
