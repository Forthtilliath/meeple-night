import {
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { namedMembers } from '../../bot/members.js';
import { type BotContext, type ChatInput, customId } from '../../bot/types.js';
import { attendance } from '../../domain/reminders.js';
import { t } from '../../i18n/index.js';
import { getGame } from '../../repositories/games.js';
import { getNight, getRsvps } from '../../repositories/nights.js';

export const PLAY_MODAL_PREFIX = 'playnight';
export const RANKING_INPUT = 'ranking';

/**
 * Opens a form prefilled with the night's confirmed attendees, one per line: the user only
 * reorders them (winner first), removes absentees and optionally adds scores.
 */
export async function recordFromNightCommand(interaction: ChatInput, { db }: BotContext) {
  const m = t(interaction.locale);
  const reply = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
  const night = getNight(db, interaction.guildId, interaction.options.getInteger('night', true));
  if (night?.status !== 'scheduled') {
    await reply(m.common.nightNotFound);
    return;
  }
  const gameId = interaction.options.getInteger('game') ?? night.gameId;
  const game = gameId ? getGame(db, interaction.guildId, gameId) : undefined;
  if (!game) {
    await reply(gameId ? m.common.gameNotFound : m.play.noGame);
    return;
  }
  const confirmed = attendance(getRsvps(db, night.id), night.maxPlayers).confirmed;
  if (confirmed.length < 2) {
    await reply(m.play.noAttendees);
    return;
  }

  const people = await namedMembers(interaction.guild, confirmed);
  const input = new TextInputBuilder()
    .setCustomId(RANKING_INPUT)
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(2000)
    .setValue(people.map((p) => p.label).join('\n'));
  const modal = new ModalBuilder()
    .setCustomId(customId(PLAY_MODAL_PREFIX, night.id, game.id))
    .setTitle(m.play.modalTitle)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(m.play.modalLabel)
        .setDescription(m.play.modalHint)
        .setTextInputComponent(input),
    );
  await interaction.showModal(modal);
}
