import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { isManager } from '../bot/permissions.js';
import type { BotContext, ChatInput, Command } from '../bot/types.js';
import { parseMyLudoExport } from '../domain/myludo.js';
import { fitsFilter } from '../domain/voting.js';
import { localize, lt, t } from '../i18n/index.js';
import { getGame, importGames, listGames } from '../repositories/games.js';
import { countPlays } from '../repositories/plays.js';
import { autocompleteGame } from './autocomplete.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_LINES = 25;

const data = localize(
  new SlashCommandBuilder(),
  lt('collection', "The group's game collection", 'collection', 'La collection de jeux du groupe'),
)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    localize(
      sub,
      lt(
        'import',
        'Import a MyLudo export (managers)',
        'importer',
        'Importer un export MyLudo (gestionnaires)',
      ),
    ).addAttachmentOption((o) =>
      localize(
        o,
        lt('file', 'JSON file exported from MyLudo', 'fichier', 'Fichier JSON exporté de MyLudo'),
      ).setRequired(true),
    ),
  )
  .addSubcommand((sub) =>
    localize(sub, lt('list', 'Browse the collection', 'liste', 'Parcourir la collection'))
      .addIntegerOption((o) =>
        localize(o, lt('players', 'Number of players', 'joueurs', 'Nombre de joueurs'))
          .setMinValue(1)
          .setMaxValue(50),
      )
      .addIntegerOption((o) =>
        localize(
          o,
          lt('max_duration', 'Maximum duration (minutes)', 'duree_max', 'Durée maximum (minutes)'),
        ).setMinValue(5),
      ),
  )
  .addSubcommand((sub) =>
    localize(sub, lt('info', 'Details of a game', 'info', "Fiche d'un jeu")).addIntegerOption((o) =>
      localize(o, lt('game', 'Game', 'jeu', 'Jeu'))
        .setRequired(true)
        .setAutocomplete(true),
    ),
  );

async function importCollection(interaction: ChatInput, { db }: BotContext): Promise<void> {
  const m = t(interaction.locale);
  if (!isManager(interaction)) {
    await interaction.reply({ content: m.common.noPermission, flags: MessageFlags.Ephemeral });
    return;
  }
  const file = interaction.options.getAttachment('file', true);
  if (!file.name.toLowerCase().endsWith('.json')) {
    await interaction.reply({ content: m.collection.invalidFile, flags: MessageFlags.Ephemeral });
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    await interaction.reply({ content: m.collection.tooLarge, flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  let parsed: ReturnType<typeof parseMyLudoExport>;
  try {
    const response = await fetch(file.url);
    parsed = parseMyLudoExport(await response.text());
  } catch {
    await interaction.editReply(m.collection.parseError);
    return;
  }
  const { created, updated } = importGames(db, interaction.guildId, parsed.games);
  await interaction.editReply(m.collection.imported(created, updated, parsed.skipped));
}

async function listCollection(interaction: ChatInput, { db }: BotContext): Promise<void> {
  const m = t(interaction.locale);
  const all = listGames(db, interaction.guildId);
  if (all.length === 0) {
    await interaction.reply({ content: m.collection.empty, flags: MessageFlags.Ephemeral });
    return;
  }
  const games = all.filter((game) =>
    fitsFilter(game, {
      players: interaction.options.getInteger('players'),
      maxDuration: interaction.options.getInteger('max_duration'),
    }),
  );
  if (games.length === 0) {
    await interaction.reply({ content: m.collection.noMatch, flags: MessageFlags.Ephemeral });
    return;
  }
  const lines = games
    .slice(0, MAX_LINES)
    .map(
      (g) =>
        `**${g.title}** · ${m.common.players(g.minPlayers, g.maxPlayers)} · ${m.common.duration(g.minDuration, g.maxDuration)}`,
    );
  const embed = new EmbedBuilder()
    .setTitle(m.collection.listTitle(games.length))
    .setDescription(lines.join('\n'));
  if (games.length > MAX_LINES)
    embed.setFooter({ text: m.collection.more(games.length - MAX_LINES) });
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function showGame(interaction: ChatInput, { db }: BotContext): Promise<void> {
  const m = t(interaction.locale);
  const game = getGame(db, interaction.guildId, interaction.options.getInteger('game', true));
  if (!game) {
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
    embed.addFields({ name: c.categories, value: game.categories.join(', ') });
  }
  if (game.mechanics.length > 0) {
    embed.addFields({ name: c.mechanics, value: game.mechanics.join(', ') });
  }
  await interaction.reply({ embeds: [embed] });
}

export const collection: Command = {
  data,

  async execute(interaction, ctx) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'import') await importCollection(interaction, ctx);
    else if (sub === 'list') await listCollection(interaction, ctx);
    else await showGame(interaction, ctx);
  },

  autocomplete: autocompleteGame,
};
