import { MessageFlags } from 'discord.js';
import type { BotContext, ChatInput } from '../../bot/types.js';
import { pickCandidates } from '../../domain/voting.js';
import { t } from '../../i18n/index.js';
import { listGames } from '../../repositories/games.js';
import type { GuildSettings } from '../../repositories/guilds.js';
import { createPoll, setPollMessage } from '../../repositories/polls.js';
import { renderPoll } from '../../ui/poll-message.js';
import { checkVote, closingTime, readVoteOptions } from './setup.js';

const DEFAULT_CHOICES = 5;

/** /vote start: a vote among random games fitting the filters. */
export async function startVoteCommand(
  interaction: ChatInput,
  { db }: BotContext,
  settings: GuildSettings,
): Promise<void> {
  const m = t(interaction.locale);
  const reply = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
  const options = readVoteOptions(interaction);
  const check = checkVote(
    db,
    interaction,
    interaction.guildId,
    settings.organizerRoleId,
    options,
    m,
  );
  if (!check.ok) {
    await reply(check.error);
    return;
  }

  const candidates = pickCandidates(
    listGames(db, interaction.guildId),
    {
      players: check.players,
      minDuration: interaction.options.getInteger('min_duration'),
      maxDuration: interaction.options.getInteger('max_duration'),
    },
    interaction.options.getInteger('choices') ?? DEFAULT_CHOICES,
  );
  if (candidates.length < 2) {
    await reply(m.vote.notEnough);
    return;
  }

  const poll = createPoll(db, {
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    nightId: check.night?.id ?? null,
    players: check.players,
    createdBy: interaction.user.id,
    gameIds: candidates.map((g) => g.id),
    closesAt: closingTime(options.hours, check.night),
    attendeesOnly: options.attendeesOnly,
  });
  const response = await interaction.reply({
    ...renderPoll(db, poll, settings.locale ?? interaction.guildLocale),
    withResponse: true,
  });
  const messageId = response.resource?.message?.id;
  if (messageId) setPollMessage(db, poll.id, messageId);
}
