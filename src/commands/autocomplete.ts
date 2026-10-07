import type { AutocompleteInteraction } from 'discord.js';
import type { BotContext } from '../bot/types.js';
import { searchGames } from '../repositories/games.js';
import { getSettings } from '../repositories/guilds.js';
import { upcomingNights } from '../repositories/nights.js';

const MAX_CHOICE_LENGTH = 100;

const truncate = (text: string) =>
  text.length > MAX_CHOICE_LENGTH ? `${text.slice(0, MAX_CHOICE_LENGTH - 1)}…` : text;

/** Suggests games of the collection matching what the user is typing. */
export async function autocompleteGame(
  interaction: AutocompleteInteraction<'cached'>,
  { db }: BotContext,
): Promise<void> {
  const query = interaction.options.getFocused();
  const games = searchGames(db, interaction.guildId, query, 25);
  await interaction.respond(games.map((g) => ({ name: truncate(g.title), value: g.id })));
}

/** Suggests upcoming game nights, labelled with their date in the server's timezone. */
export async function autocompleteNight(
  interaction: AutocompleteInteraction<'cached'>,
  { db, timezone }: BotContext,
): Promise<void> {
  const query = interaction.options.getFocused().toLowerCase();
  const format = new Intl.DateTimeFormat(interaction.locale, {
    timeZone: getSettings(db, interaction.guildId, timezone).timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const nights = upcomingNights(db, interaction.guildId, new Date())
    .map((n) => ({ name: truncate(`${format.format(n.startsAt)} — ${n.title}`), value: n.id }))
    .filter((choice) => choice.name.toLowerCase().includes(query));
  await interaction.respond(nights.slice(0, 25));
}
