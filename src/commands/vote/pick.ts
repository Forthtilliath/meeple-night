import { MessageFlags } from 'discord.js';
import type { BotContext, ChatInput } from '../../bot/types.js';
import { fitsFilter } from '../../domain/voting.js';
import { t } from '../../i18n/index.js';
import { listGames } from '../../repositories/games.js';
import type { GuildSettings } from '../../repositories/guilds.js';
import { type PickParams, renderPicker } from '../../ui/vote-picker.js';
import { checkVote, readVoteOptions } from './setup.js';

/** /vote pick: lists the games fitting the filters so the member ticks those to offer. */
export async function pickVoteCommand(
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

  const params: PickParams = {
    ...options,
    players: check.players,
    minDuration: interaction.options.getInteger('min_duration'),
    maxDuration: interaction.options.getInteger('max_duration'),
  };
  const games = listGames(db, interaction.guildId).filter((g) => fitsFilter(g, params));
  if (games.length < 2) {
    await reply(m.vote.notEnough);
    return;
  }
  await interaction.reply({
    ...renderPicker(games, new Set(), params, interaction.locale),
    flags: MessageFlags.Ephemeral,
  });
}
