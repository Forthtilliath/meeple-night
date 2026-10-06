import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../bot/types.js';
import { attendance } from '../domain/reminders.js';
import { pickCandidates } from '../domain/voting.js';
import { localize, lt, t } from '../i18n/index.js';
import { listGames } from '../repositories/games.js';
import { getNight, getRsvps } from '../repositories/nights.js';
import { createPoll, setPollMessage } from '../repositories/polls.js';
import { renderPoll } from '../ui/poll-message.js';
import { autocompleteNight } from './autocomplete.js';

const DEFAULT_CHOICES = 5;

const data = localize(
  new SlashCommandBuilder(),
  lt('vote', 'Vote for the game to play', 'vote', 'Voter pour le jeu à sortir'),
)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    localize(
      sub,
      lt(
        'start',
        'Start a vote among random fitting games',
        'lancer',
        'Lancer un vote parmi des jeux adaptés',
      ),
    )
      .addIntegerOption((o) =>
        localize(
          o,
          lt(
            'night',
            'Use the attendees of this night',
            'soiree',
            'Utiliser les inscrits de cette soirée',
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
          lt('max_duration', 'Maximum duration (minutes)', 'duree_max', 'Durée maximum (minutes)'),
        ).setMinValue(5),
      )
      .addIntegerOption((o) =>
        localize(
          o,
          lt('choices', 'Number of games to choose from', 'choix', 'Nombre de jeux proposés'),
        )
          .setMinValue(2)
          .setMaxValue(25),
      ),
  );

export const vote: Command = {
  data,

  async execute(interaction, { db }) {
    const m = t(interaction.locale);
    const nightId = interaction.options.getInteger('night');
    const night = nightId ? getNight(db, interaction.guildId, nightId) : undefined;
    if (nightId && !night) {
      await interaction.reply({ content: m.common.nightNotFound, flags: MessageFlags.Ephemeral });
      return;
    }

    let players = interaction.options.getInteger('players');
    if (!players && night) {
      players = attendance(getRsvps(db, night.id), night.maxPlayers).confirmed.length || null;
    }

    const candidates = pickCandidates(
      listGames(db, interaction.guildId),
      { players, maxDuration: interaction.options.getInteger('max_duration') },
      interaction.options.getInteger('choices') ?? DEFAULT_CHOICES,
    );
    if (candidates.length < 2) {
      await interaction.reply({ content: m.vote.notEnough, flags: MessageFlags.Ephemeral });
      return;
    }

    const poll = createPoll(db, {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      nightId: night?.id ?? null,
      players,
      createdBy: interaction.user.id,
      gameIds: candidates.map((g) => g.id),
    });
    const response = await interaction.reply({
      ...renderPoll(db, poll, interaction.guildLocale),
      withResponse: true,
    });
    const messageId = response.resource?.message?.id;
    if (messageId) setPollMessage(db, poll.id, messageId);
  },

  autocomplete: autocompleteNight,
};
