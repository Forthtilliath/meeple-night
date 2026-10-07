import {
  InteractionContextType,
  SlashCommandBuilder,
  type SlashCommandSubcommandBuilder,
} from 'discord.js';
import type { Command } from '../../bot/types.js';
import { localize, lt } from '../../i18n/index.js';
import { getSettings } from '../../repositories/guilds.js';
import { autocompleteNight } from '../autocomplete.js';
import { pickVoteCommand } from './pick.js';
import { startVoteCommand } from './start.js';

/** Night and game filters, shared by both ways of starting a vote. */
const withFilters = (sub: SlashCommandSubcommandBuilder) =>
  sub
    .addIntegerOption((o) =>
      localize(
        o,
        lt(
          'night',
          'Use the attendees of this night (the winner becomes its game)',
          'soiree',
          'Utiliser les inscrits de cette soirée (le gagnant devient son jeu)',
        ),
      ).setAutocomplete(true),
    )
    .addIntegerOption((o) =>
      localize(o, lt('players', 'Number of players', 'joueurs', 'Nombre de joueurs'))
        .setMinValue(1)
        .setMaxValue(50),
    )
    .addIntegerOption((o) =>
      localize(
        o,
        lt('min_duration', 'Minimum duration (minutes)', 'duree_min', 'Durée minimum (minutes)'),
      ).setMinValue(5),
    )
    .addIntegerOption((o) =>
      localize(
        o,
        lt('max_duration', 'Maximum duration (minutes)', 'duree_max', 'Durée maximum (minutes)'),
      ).setMinValue(5),
    );

/** Closing and voter options of the poll itself. */
const withPollOptions = (sub: SlashCommandSubcommandBuilder) =>
  sub
    .addIntegerOption((o) =>
      localize(
        o,
        lt(
          'hours',
          'Close automatically after this many hours (default: at the night)',
          'heures',
          'Clore automatiquement après ce nombre d’heures (défaut : à la soirée)',
        ),
      )
        .setMinValue(1)
        .setMaxValue(168),
    )
    .addBooleanOption((o) =>
      localize(
        o,
        lt(
          'attendees_only',
          "Only the night's confirmed attendees can vote",
          'inscrits_seulement',
          'Seuls les inscrits confirmés de la soirée votent',
        ),
      ),
    );

const data = localize(
  new SlashCommandBuilder(),
  lt('vote', 'Vote for the game to play', 'vote', 'Voter pour le jeu à sortir'),
)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    withPollOptions(
      withFilters(
        localize(
          sub,
          lt(
            'start',
            'Start a vote among random fitting games',
            'lancer',
            'Lancer un vote parmi des jeux adaptés',
          ),
        ),
      ).addIntegerOption((o) =>
        localize(
          o,
          lt('choices', 'Number of games to choose from', 'choix', 'Nombre de jeux proposés'),
        )
          .setMinValue(2)
          .setMaxValue(25),
      ),
    ),
  )
  .addSubcommand((sub) =>
    withPollOptions(
      withFilters(
        localize(
          sub,
          lt(
            'pick',
            'Pick the games of the vote from the fitting ones',
            'choisir',
            'Choisir les jeux du vote parmi ceux adaptés',
          ),
        ),
      ),
    ),
  );

export const vote: Command = {
  data,

  async execute(interaction, ctx) {
    const settings = getSettings(ctx.db, interaction.guildId, ctx.timezone);
    if (interaction.options.getSubcommand() === 'pick') {
      await pickVoteCommand(interaction, ctx, settings);
    } else {
      await startVoteCommand(interaction, ctx, settings);
    }
  },

  autocomplete: autocompleteNight,
};
