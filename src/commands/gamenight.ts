import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { canManage } from '../bot/permissions.js';
import type { Command } from '../bot/types.js';
import { discordTimestamp, parseLocalDateTime } from '../domain/dates.js';
import { localize, lt, t } from '../i18n/index.js';
import {
  cancelNight,
  createNight,
  getNight,
  setNightMessage,
  upcomingNights,
} from '../repositories/nights.js';
import { refreshNightMessage, renderNight } from '../ui/night-message.js';
import { autocompleteNight } from './autocomplete.js';

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
      ),
  )
  .addSubcommand((sub) =>
    localize(sub, lt('list', 'Show upcoming game nights', 'liste', 'Voir les prochaines soirées')),
  )
  .addSubcommand((sub) =>
    localize(
      sub,
      lt('cancel', 'Cancel a game night', 'annuler', 'Annuler une soirée'),
    ).addIntegerOption((o) =>
      localize(o, lt('night', 'Game night to cancel', 'soiree', 'Soirée à annuler'))
        .setRequired(true)
        .setAutocomplete(true),
    ),
  );

export const gamenight: Command = {
  data,

  async execute(interaction, ctx) {
    const m = t(interaction.locale);
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const startsAt = parseLocalDateTime(
        interaction.options.getString('date', true),
        interaction.options.getString('time', true),
        ctx.timezone,
      );
      if (!startsAt) {
        await interaction.reply({ content: m.night.invalidDate, flags: MessageFlags.Ephemeral });
        return;
      }
      if (startsAt <= new Date()) {
        await interaction.reply({ content: m.night.pastDate, flags: MessageFlags.Ephemeral });
        return;
      }
      const night = createNight(ctx.db, {
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        title: interaction.options.getString('title', true),
        location: interaction.options.getString('location'),
        startsAt,
        maxPlayers: interaction.options.getInteger('max_players'),
        createdBy: interaction.user.id,
      });
      const response = await interaction.reply({
        ...renderNight(ctx.db, night, interaction.guildLocale),
        withResponse: true,
      });
      const messageId = response.resource?.message?.id;
      if (messageId) setNightMessage(ctx.db, night.id, messageId);
      return;
    }

    if (sub === 'list') {
      const nights = upcomingNights(ctx.db, interaction.guildId, new Date(), 10);
      if (nights.length === 0) {
        await interaction.reply({ content: m.night.noUpcoming, flags: MessageFlags.Ephemeral });
        return;
      }
      const lines = nights.map((n) => {
        const link = n.messageId
          ? `https://discord.com/channels/${n.guildId}/${n.channelId}/${n.messageId}`
          : null;
        const title = link ? `[${n.title}](${link})` : n.title;
        return `**${title}** — ${discordTimestamp(n.startsAt, 'f')} (${discordTimestamp(n.startsAt, 'R')})`;
      });
      const embed = new EmbedBuilder()
        .setTitle(m.night.upcomingTitle)
        .setDescription(lines.join('\n'));
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    const night = getNight(
      ctx.db,
      interaction.guildId,
      interaction.options.getInteger('night', true),
    );
    if (!night) {
      await interaction.reply({ content: m.common.nightNotFound, flags: MessageFlags.Ephemeral });
      return;
    }
    if (!canManage(interaction, night.createdBy)) {
      await interaction.reply({ content: m.common.noPermission, flags: MessageFlags.Ephemeral });
      return;
    }
    cancelNight(ctx.db, night.id);
    await refreshNightMessage(ctx.client, ctx.db, { ...night, status: 'cancelled' });
    await interaction.reply({ content: m.night.cancelled, flags: MessageFlags.Ephemeral });
  },

  autocomplete: autocompleteNight,
};
