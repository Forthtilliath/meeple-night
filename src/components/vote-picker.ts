import { type MessageComponentInteraction, MessageFlags } from 'discord.js';
import type { BotContext, ComponentHandler } from '../bot/types.js';
import { checkVote, closingTime } from '../commands/vote/setup.js';
import type { Game } from '../db/schema.js';
import { fitsFilter } from '../domain/voting.js';
import { t } from '../i18n/index.js';
import { listGames } from '../repositories/games.js';
import { getSettings } from '../repositories/guilds.js';
import { createPoll, setPollMessage } from '../repositories/polls.js';
import { renderPoll } from '../ui/poll-message.js';
import {
  decodePick,
  MAX_POLL_GAMES,
  type PickParams,
  readSelection,
  renderPicker,
  VOTE_PICK_PREFIX,
} from '../ui/vote-picker.js';

/** Starts the vote with the ticked games, then closes the picker. */
async function launch(
  interaction: MessageComponentInteraction<'cached'>,
  { db, timezone }: BotContext,
  params: PickParams,
  games: Game[],
): Promise<void> {
  const m = t(interaction.locale);
  const reply = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
  // Games removed since the picker was shown are dropped.
  const available = new Set(games.map((g) => g.id));
  const gameIds = [...new Set(readSelection(interaction.message))].filter((id) =>
    available.has(id),
  );
  if (gameIds.length < 2 || gameIds.length > MAX_POLL_GAMES) {
    await reply(m.vote.pickCount(MAX_POLL_GAMES));
    return;
  }
  const settings = getSettings(db, interaction.guildId, timezone);
  const check = checkVote(
    db,
    interaction,
    interaction.guildId,
    settings.organizerRoleId,
    params,
    m,
  );
  if (!check.ok) {
    await reply(check.error);
    return;
  }

  const poll = createPoll(db, {
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    nightId: check.night?.id ?? null,
    players: check.players,
    createdBy: interaction.user.id,
    gameIds,
    closesAt: closingTime(params.hours, check.night),
    attendeesOnly: params.attendeesOnly,
  });
  await interaction.update({ content: m.vote.pickDone, embeds: [], components: [] });
  const message = await interaction.followUp(
    renderPoll(db, poll, settings.locale ?? interaction.guildLocale),
  );
  setPollMessage(db, poll.id, message.id);
}

/** Menus and launch button of /vote pick. */
export const votePickerHandler: ComponentHandler = {
  prefix: VOTE_PICK_PREFIX,

  async handle(interaction, [action = '', ...args], ctx) {
    const params = decodePick(args);
    const games = listGames(ctx.db, interaction.guildId).filter((g) => fitsFilter(g, params));
    if (action === 'go') {
      await launch(interaction, ctx, params, games);
      return;
    }
    if (!interaction.isStringSelectMenu()) return;
    const selected = new Set([
      ...readSelection(interaction.message, interaction.customId),
      ...interaction.values.map(Number),
    ]);
    await interaction.update(renderPicker(games, selected, params, interaction.locale));
  },
};
