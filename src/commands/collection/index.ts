import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../bot/types.js';
import { localize, lt } from '../../i18n/index.js';
import { autocompleteGame } from '../autocomplete.js';
import { listCollection, showGame } from './browse.js';
import { importCollection } from './import.js';
import { addGameCommand, removeGameCommand } from './manage.js';

const players = lt('players', 'Number of players', 'joueurs', 'Nombre de joueurs');
const maxDuration = lt(
  'max_duration',
  'Maximum duration (minutes)',
  'duree_max',
  'Durée maximum (minutes)',
);
const game = (description: string, frDescription: string) =>
  lt('game', description, 'jeu', frDescription);

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
        'Import a MyLudo export (organizers)',
        'importer',
        'Importer un export MyLudo (organisateurs)',
      ),
    )
      .addAttachmentOption((o) =>
        localize(
          o,
          lt('file', 'JSON file exported from MyLudo', 'fichier', 'Fichier JSON exporté de MyLudo'),
        ).setRequired(true),
      )
      .addBooleanOption((o) =>
        localize(
          o,
          lt(
            'sync',
            'Also remove the games missing from the file',
            'synchroniser',
            'Retirer aussi les jeux absents du fichier',
          ),
        ),
      ),
  )
  .addSubcommand((sub) =>
    localize(sub, lt('list', 'Browse the collection', 'liste', 'Parcourir la collection'))
      .addIntegerOption((o) => localize(o, players).setMinValue(1).setMaxValue(50))
      .addIntegerOption((o) => localize(o, maxDuration).setMinValue(5)),
  )
  .addSubcommand((sub) =>
    localize(sub, lt('info', 'Details of a game', 'info', "Fiche d'un jeu")).addIntegerOption((o) =>
      localize(o, game('Game', 'Jeu')).setRequired(true).setAutocomplete(true),
    ),
  )
  .addSubcommand((sub) =>
    localize(
      sub,
      lt('add', 'Add a game by hand (organizers)', 'ajouter', 'Ajouter un jeu (organisateurs)'),
    )
      .addStringOption((o) =>
        localize(o, lt('title', 'Name of the game', 'titre', 'Nom du jeu'))
          .setRequired(true)
          .setMaxLength(100),
      )
      .addIntegerOption((o) =>
        localize(o, lt('min_players', 'Minimum players', 'joueurs_min', 'Joueurs minimum'))
          .setMinValue(1)
          .setMaxValue(50),
      )
      .addIntegerOption((o) =>
        localize(o, lt('max_players', 'Maximum players', 'joueurs_max', 'Joueurs maximum'))
          .setMinValue(1)
          .setMaxValue(50),
      )
      .addIntegerOption((o) =>
        localize(o, lt('duration', 'Duration (minutes)', 'duree', 'Durée (minutes)'))
          .setMinValue(5)
          .setMaxValue(1440),
      ),
  )
  .addSubcommand((sub) =>
    localize(
      sub,
      lt(
        'remove',
        'Remove a game, keeping its plays (organizers)',
        'retirer',
        'Retirer un jeu, ses parties restent (organisateurs)',
      ),
    ).addIntegerOption((o) =>
      localize(o, game('Game to remove', 'Jeu à retirer')).setRequired(true).setAutocomplete(true),
    ),
  );

export const collection: Command = {
  data,

  async execute(interaction, ctx) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'import') await importCollection(interaction, ctx);
    else if (sub === 'list') await listCollection(interaction, ctx);
    else if (sub === 'add') await addGameCommand(interaction, ctx);
    else if (sub === 'remove') await removeGameCommand(interaction, ctx);
    else await showGame(interaction, ctx);
  },

  autocomplete: autocompleteGame,
};
