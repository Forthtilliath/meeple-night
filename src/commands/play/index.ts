import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../bot/types.js';
import { localize, lt } from '../../i18n/index.js';
import { getSettings } from '../../repositories/guilds.js';
import { recentNights } from '../../repositories/nights.js';
import { recentPlays } from '../../repositories/plays.js';
import { autocompleteAnyGame, autocompleteGame, truncate } from '../autocomplete.js';
import { recordFromNightCommand } from './from-night.js';
import { playHistoryCommand, undoPlayCommand } from './history.js';
import { MAX_PLAYERS, recordPlayCommand } from './record.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const data = localize(
  new SlashCommandBuilder(),
  lt('play', 'Track the games you played', 'partie', 'Suivre les parties jouées'),
)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) => {
    localize(
      sub,
      lt(
        'record',
        'Record a play, players in finishing order',
        'enregistrer',
        "Enregistrer une partie, joueurs dans l'ordre d'arrivée",
      ),
    ).addIntegerOption((o) =>
      localize(o, lt('game', 'Game played', 'jeu', 'Jeu joué'))
        .setRequired(true)
        .setAutocomplete(true),
    );
    for (let i = 1; i <= MAX_PLAYERS; i++) {
      sub.addUserOption((o) =>
        localize(
          o,
          lt(
            `player${i}`,
            i === 1 ? 'Winner' : `Player ranked #${i}`,
            `joueur${i}`,
            i === 1 ? 'Gagnant' : `Joueur classé n°${i}`,
          ),
        ).setRequired(i <= 2),
      );
    }
    return sub.addStringOption((o) =>
      localize(
        o,
        lt(
          'scores',
          'Optional scores in player order, e.g. 52,47,47 (ranks follow scores)',
          'scores',
          "Scores optionnels dans l'ordre des joueurs, ex. 52,47,47",
        ),
      ),
    );
  })
  .addSubcommand((sub) =>
    localize(
      sub,
      lt(
        'from_night',
        "Record a play among a night's attendees",
        'depuis_soiree',
        "Enregistrer une partie parmi les inscrits d'une soirée",
      ),
    )
      .addIntegerOption((o) =>
        localize(o, lt('night', 'Game night', 'soiree', 'Soirée'))
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addIntegerOption((o) =>
        localize(
          o,
          lt(
            'game',
            'Game played (default: the voted one)',
            'jeu',
            'Jeu joué (défaut : celui voté)',
          ),
        ).setAutocomplete(true),
      ),
  )
  .addSubcommand((sub) =>
    localize(sub, lt('history', 'Latest plays', 'historique', 'Dernières parties'))
      .addIntegerOption((o) =>
        localize(o, lt('game', 'Only this game', 'jeu', 'Seulement ce jeu')).setAutocomplete(true),
      )
      .addUserOption((o) =>
        localize(o, lt('player', 'Only this player', 'joueur', 'Seulement ce joueur')),
      ),
  )
  .addSubcommand((sub) =>
    localize(
      sub,
      lt('undo', 'Delete a mistaken play', 'annuler', 'Supprimer une partie erronée'),
    ).addIntegerOption((o) =>
      localize(o, lt('play', 'Play to delete', 'partie', 'Partie à supprimer'))
        .setRequired(true)
        .setAutocomplete(true),
    ),
  );

export const play: Command = {
  data,

  async execute(interaction, ctx) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'record') await recordPlayCommand(interaction, ctx);
    else if (sub === 'from_night') await recordFromNightCommand(interaction, ctx);
    else if (sub === 'history') await playHistoryCommand(interaction, ctx);
    else await undoPlayCommand(interaction, ctx);
  },

  async autocomplete(interaction, ctx) {
    const focused = interaction.options.getFocused(true);
    const sub = interaction.options.getSubcommand();
    if (focused.name === 'game') {
      // History may target games removed from the collection since.
      await (sub === 'history' ? autocompleteAnyGame : autocompleteGame)(interaction, ctx);
      return;
    }

    const { timezone } = getSettings(ctx.db, interaction.guildId, ctx.timezone);
    const format = new Intl.DateTimeFormat(interaction.locale, {
      timeZone: timezone,
      dateStyle: 'short',
    });
    const query = focused.value.toLowerCase();
    let choices: { name: string; value: number }[];
    if (focused.name === 'night') {
      const now = Date.now();
      choices = recentNights(
        ctx.db,
        interaction.guildId,
        new Date(now - 3 * DAY_MS),
        new Date(now + DAY_MS / 2),
      ).map((n) => ({ name: truncate(`${format.format(n.startsAt)} — ${n.title}`), value: n.id }));
    } else {
      choices = recentPlays(ctx.db, interaction.guildId, {}, 25).map((p) => ({
        name: truncate(`#${p.id} · ${p.gameTitle} · ${format.format(p.playedAt)}`),
        value: p.id,
      }));
    }
    await interaction.respond(
      choices.filter((c) => c.name.toLowerCase().includes(query)).slice(0, 25),
    );
  },
};
