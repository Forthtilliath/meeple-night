import { EmbedBuilder, MessageFlags } from 'discord.js';
import type { BotContext, ChatInput } from '../../bot/types.js';
import { type CandidateFilter, fitsFilter } from '../../domain/voting.js';
import { t } from '../../i18n/index.js';
import { getGame, listGames } from '../../repositories/games.js';
import { countPlays } from '../../repositories/plays.js';
import { renderCollectionPage } from '../../ui/collection-message.js';
import { plain } from '../../ui/text.js';

export async function listCollection(interaction: ChatInput, { db }: BotContext): Promise<void> {
  const m = t(interaction.locale);
  const reply = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
  const all = listGames(db, interaction.guildId);
  if (all.length === 0) {
    await reply(m.collection.empty);
    return;
  }
  const filter: CandidateFilter = {
    players: interaction.options.getInteger('players'),
    maxDuration: interaction.options.getInteger('max_duration'),
  };
  const games = all.filter((game) => fitsFilter(game, filter));
  if (games.length === 0) {
    await reply(m.collection.noMatch);
    return;
  }
  await interaction.reply({
    ...renderCollectionPage(games, 0, filter, interaction.locale),
    flags: MessageFlags.Ephemeral,
  });
}

export async function showGame(interaction: ChatInput, { db }: BotContext): Promise<void> {
  const m = t(interaction.locale);
  const game = getGame(db, interaction.guildId, interaction.options.getInteger('game', true));
  if (!game || game.archived) {
    await interaction.reply({ content: m.common.gameNotFound, flags: MessageFlags.Ephemeral });
    return;
  }
  const c = m.collection;
  const embed = new EmbedBuilder().setTitle(game.title).addFields(
    { name: c.players, value: m.common.players(game.minPlayers, game.maxPlayers), inline: true },
    {
      name: c.duration,
      value: m.common.duration(game.minDuration, game.maxDuration),
      inline: true,
    },
    { name: c.plays, value: String(countPlays(db, interaction.guildId, game.id)), inline: true },
  );
  if (game.minAge) embed.addFields({ name: c.age, value: `${game.minAge}+`, inline: true });
  if (game.year) embed.addFields({ name: c.year, value: String(game.year), inline: true });
  if (game.rating) embed.addFields({ name: c.rating, value: `${game.rating}/10`, inline: true });
  if (game.categories.length > 0) {
    embed.addFields({ name: c.categories, value: plain(game.categories.join(', ')) });
  }
  if (game.mechanics.length > 0) {
    embed.addFields({ name: c.mechanics, value: plain(game.mechanics.join(', ')) });
  }
  await interaction.reply({ embeds: [embed] });
}
