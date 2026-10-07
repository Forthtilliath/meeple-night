import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { isManager } from '../bot/permissions.js';
import type { Command } from '../bot/types.js';
import { attendance, HOUR_MS } from '../domain/reminders.js';
import { pickCandidates } from '../domain/voting.js';
import { localize, lt, t } from '../i18n/index.js';
import { listGames } from '../repositories/games.js';
import { getSettings } from '../repositories/guilds.js';
import { getNight, getRsvps } from '../repositories/nights.js';
import { countOpenPollsBy, createPoll, setPollMessage } from '../repositories/polls.js';
import { renderPoll } from '../ui/poll-message.js';
import { autocompleteNight } from './autocomplete.js';

const DEFAULT_CHOICES = 5;
/** Members without the organizer role can't run more open votes than this. */
export const MAX_OPEN_POLLS_PER_MEMBER = 3;

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
      )
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
      ),
  );

export const vote: Command = {
  data,

  async execute(interaction, { db, timezone }) {
    const m = t(interaction.locale);
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });
    const nightId = interaction.options.getInteger('night');
    const night = nightId ? getNight(db, interaction.guildId, nightId) : undefined;
    if (nightId && !night) {
      await reply(m.common.nightNotFound);
      return;
    }
    const attendeesOnly = interaction.options.getBoolean('attendees_only') ?? false;
    if (attendeesOnly && !night) {
      await reply(m.vote.needNight);
      return;
    }
    const { organizerRoleId, locale } = getSettings(db, interaction.guildId, timezone);
    if (
      !isManager(interaction, organizerRoleId) &&
      countOpenPollsBy(db, interaction.guildId, interaction.user.id) >= MAX_OPEN_POLLS_PER_MEMBER
    ) {
      await reply(m.vote.tooMany(MAX_OPEN_POLLS_PER_MEMBER));
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
      await reply(m.vote.notEnough);
      return;
    }

    const now = Date.now();
    const hours = interaction.options.getInteger('hours');
    const closesAt = hours
      ? new Date(now + hours * HOUR_MS)
      : night && night.startsAt.getTime() > now
        ? night.startsAt
        : null;
    const poll = createPoll(db, {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      nightId: night?.id ?? null,
      players,
      createdBy: interaction.user.id,
      gameIds: candidates.map((g) => g.id),
      closesAt,
      attendeesOnly,
    });
    const response = await interaction.reply({
      ...renderPoll(db, poll, locale ?? interaction.guildLocale),
      withResponse: true,
    });
    const messageId = response.resource?.message?.id;
    if (messageId) setPollMessage(db, poll.id, messageId);
  },

  autocomplete: autocompleteNight,
};
