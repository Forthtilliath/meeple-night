import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  EmbedBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { postInChannel } from '../bot/channels.js';
import { customId, type RenderedMessage } from '../bot/types.js';
import type { Db } from '../db/client.js';
import type { GameNight, RsvpStatus } from '../db/schema.js';
import { discordTimestamp } from '../domain/dates.js';
import { attendance } from '../domain/reminders.js';
import { t } from '../i18n/index.js';
import { log } from '../log.js';
import { getGame } from '../repositories/games.js';
import { getRsvps } from '../repositories/nights.js';
import { plain } from './text.js';

export const RSVP_PREFIX = 'rsvp';
export const CALENDAR_PREFIX = 'ics';

const COLOR_OPEN = 0x5865f2;
const COLOR_CLOSED = 0x4f545c;
const FIELD_LIMIT = 1024;

function mentions(userIds: string[], empty: string): string {
  if (userIds.length === 0) return empty;
  const text = userIds.map((id) => `<@${id}>`).join(', ');
  return text.length > FIELD_LIMIT ? `${text.slice(0, FIELD_LIMIT - 1)}…` : text;
}

/** Link to the night's public message, once it has been posted. */
export function nightUrl(night: GameNight): string | null {
  return night.messageId
    ? `https://discord.com/channels/${night.guildId}/${night.channelId}/${night.messageId}`
    : null;
}

export function isOpen(night: GameNight, now = new Date()): boolean {
  return night.status === 'scheduled' && night.startsAt > now;
}

/** Builds the public message of a game night: details, attendees and RSVP buttons. */
export function renderNight(db: Db, night: GameNight, locale: string): RenderedMessage {
  const m = t(locale).night;
  const people = attendance(getRsvps(db, night.id), night.maxPlayers);
  const open = isOpen(night);
  const cancelled = night.status === 'cancelled';
  const game = night.gameId ? getGame(db, night.guildId, night.gameId) : undefined;

  const embed = new EmbedBuilder()
    .setTitle(cancelled ? m.cancelledTitle(night.title) : night.title)
    .setColor(open ? COLOR_OPEN : COLOR_CLOSED)
    .addFields({
      name: m.when,
      value: `${discordTimestamp(night.startsAt, 'F')} (${discordTimestamp(night.startsAt, 'R')})`,
    })
    .setFooter({ text: m.footer(night.id, night.recurrence) });
  if (night.location) {
    embed.addFields({ name: m.where, value: plain(night.location), inline: true });
  }
  if (game) embed.addFields({ name: m.game, value: plain(game.title), inline: true });
  embed.addFields(
    { name: m.organizer, value: `<@${night.createdBy}>`, inline: true },
    {
      name: m.going(people.confirmed.length, night.maxPlayers),
      value: mentions(people.confirmed, m.nobody),
    },
  );
  if (people.waitlist.length > 0) {
    embed.addFields({ name: m.waitlist, value: mentions(people.waitlist, m.nobody) });
  }
  embed.addFields(
    { name: m.maybe, value: mentions(people.maybe, m.nobody), inline: true },
    { name: m.declined, value: mentions(people.declined, m.nobody), inline: true },
  );

  const button = (status: RsvpStatus, label: string, style: ButtonStyle) =>
    new ButtonBuilder()
      .setCustomId(customId(RSVP_PREFIX, night.id, status))
      .setLabel(label)
      .setStyle(style)
      .setDisabled(!open);
  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    button('yes', m.buttonYes, ButtonStyle.Success),
    button('maybe', m.buttonMaybe, ButtonStyle.Secondary),
    button('no', m.buttonNo, ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(customId(CALENDAR_PREFIX, night.id))
      .setLabel(m.calendar)
      .setEmoji('📅')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!open),
  );

  return { embeds: [embed], components: [row] };
}

/** Re-renders a night's message after a change made outside of a button click. */
export async function refreshNightMessage(client: Client, db: Db, night: GameNight): Promise<void> {
  if (!night.messageId) return;
  const channel = await client.channels.fetch(night.channelId).catch(() => null);
  if (!channel?.isTextBased() || channel.isDMBased()) return;
  await channel.messages
    .edit(night.messageId, renderNight(db, night, channel.guild.preferredLocale))
    .catch((error) => log.warn('Night message not refreshed', { nightId: night.id, error }));
}

/** Posts the message of a night created without an interaction (recurring occurrence). */
export async function postNightMessage(
  client: Client,
  db: Db,
  night: GameNight,
): Promise<string | null> {
  const channel = await client.channels.fetch(night.channelId).catch(() => null);
  if (!channel?.isSendable() || channel.isDMBased()) return null;
  const message = await channel.send(renderNight(db, night, channel.guild.preferredLocale));
  return message.id;
}

/** Announces something about a night in its channel; failures are logged, never thrown. */
export async function notifyNight(
  client: Client,
  night: GameNight,
  compose: (locale: string) => string,
  userIds: string[],
): Promise<void> {
  await postInChannel(client, night.channelId, compose, userIds).catch((error) =>
    log.warn('Night notice not sent', { nightId: night.id, error }),
  );
}
