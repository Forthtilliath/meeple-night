import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../bot/types.js';
import { localize, lt } from '../../i18n/index.js';
import { getSettings } from '../../repositories/guilds.js';
import { autocompleteNight } from '../autocomplete.js';
import { cancelNightCommand } from './cancel.js';
import { createNightCommand } from './create.js';
import { editNightCommand } from './edit.js';
import { listNightsCommand } from './list.js';

const nightOption = (description: string, frDescription: string) =>
  lt('night', description, 'soiree', frDescription);

const data = localize(
  new SlashCommandBuilder(),
  lt('gamenight', 'Organize game nights', 'soiree', 'Organiser des soirées jeux'),
)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    localize(sub, lt('create', 'Plan a game night', 'creer', 'Planifier une soirée'))
      .addStringOption((o) =>
        localize(o, lt('title', 'Name of the night', 'titre', 'Nom de la soirée'))
          .setRequired(true)
          .setMaxLength(100),
      )
      .addStringOption((o) =>
        localize(
          o,
          lt('date', 'e.g. 2026-10-24 or 24/10/2026', 'date', 'ex. 24/10/2026'),
        ).setRequired(true),
      )
      .addStringOption((o) =>
        localize(o, lt('time', 'e.g. 20:30', 'heure', 'ex. 20h30')).setRequired(true),
      )
      .addStringOption((o) =>
        localize(o, lt('location', 'Where it happens', 'lieu', 'Où ça se passe')).setMaxLength(200),
      )
      .addIntegerOption((o) =>
        localize(
          o,
          lt(
            'max_players',
            'Seat limit (waitlist beyond)',
            'places',
            "Nombre de places (liste d'attente au-delà)",
          ),
        )
          .setMinValue(2)
          .setMaxValue(50),
      )
      .addStringOption((o) =>
        localize(
          o,
          lt('repeat', 'Plan the next one automatically', 'repetition', 'Planifier la suivante'),
        ).addChoices(
          { name: 'Every week', name_localizations: { fr: 'Chaque semaine' }, value: 'weekly' },
          {
            name: 'Every other week',
            name_localizations: { fr: 'Une semaine sur deux' },
            value: 'biweekly',
          },
        ),
      ),
  )
  .addSubcommand((sub) =>
    localize(sub, lt('edit', 'Change a game night', 'modifier', 'Modifier une soirée'))
      .addIntegerOption((o) =>
        localize(o, nightOption('Game night to change', 'Soirée à modifier'))
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addStringOption((o) =>
        localize(o, lt('title', 'New name', 'titre', 'Nouveau nom')).setMaxLength(100),
      )
      .addStringOption((o) =>
        localize(
          o,
          lt('date', 'New date, e.g. 2026-10-24', 'date', 'Nouvelle date, ex. 24/10/2026'),
        ),
      )
      .addStringOption((o) =>
        localize(o, lt('time', 'New time, e.g. 20:30', 'heure', 'Nouvelle heure, ex. 20h30')),
      )
      .addStringOption((o) =>
        localize(o, lt('location', 'New place', 'lieu', 'Nouveau lieu')).setMaxLength(200),
      )
      .addIntegerOption((o) =>
        localize(
          o,
          lt('max_players', 'Seat limit, 0 = no limit', 'places', 'Nombre de places, 0 = illimité'),
        )
          .setMinValue(0)
          .setMaxValue(50),
      ),
  )
  .addSubcommand((sub) =>
    localize(sub, lt('list', 'Show upcoming game nights', 'liste', 'Voir les prochaines soirées')),
  )
  .addSubcommand((sub) =>
    localize(sub, lt('cancel', 'Cancel a game night', 'annuler', 'Annuler une soirée'))
      .addIntegerOption((o) =>
        localize(o, nightOption('Game night to cancel', 'Soirée à annuler'))
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addBooleanOption((o) =>
        localize(
          o,
          lt(
            'stop_series',
            'For a repeated night: stop the next ones too',
            'arreter_serie',
            'Soirée répétée : arrêter aussi les suivantes',
          ),
        ),
      ),
  );

export const gamenight: Command = {
  data,

  async execute(interaction, ctx) {
    const settings = getSettings(ctx.db, interaction.guildId, ctx.timezone);
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') await createNightCommand(interaction, ctx, settings);
    else if (sub === 'edit') await editNightCommand(interaction, ctx, settings);
    else if (sub === 'list') await listNightsCommand(interaction, ctx);
    else await cancelNightCommand(interaction, ctx, settings);
  },

  autocomplete: autocompleteNight,
};
