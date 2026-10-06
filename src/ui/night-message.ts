import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  EmbedBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { customId, type RenderedMessage } from '../bot/types.js';
import type { Db } from '../db/client.js';
import type { GameNight, RsvpStatus } from '../db/schema.js';
import { discordTimestamp } from '../domain/dates.js';
import { attendance } from '../domain/reminders.js';
import { t } from '../i18n/index.js';
import { getRsvps } from '../repositories/nights.js';

export const RSVP_PREFIX = 'rsvp';

const COLOR_OPEN = 0x5865f2;
const COLOR_CLOSED = 0x4f545c;
const FIELD_LIMIT = 1024;

function mentions(userIds: string[], empty: string): string {
  if (userIds.length === 0) return empty;
  const text = userIds.map((id) => `<@${id}>`).join(', ');
  return text.length > FIELD_LIMIT ? `${text.slice(0, FIELD_LIMIT - 1)}…` : text;
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

  const embed = new EmbedBuilder()
    .setTitle(cancelled ? m.cancelledTitle(night.title) : night.title)
    .setColor(open ? COLOR_OPEN : COLOR_CLOSED)
    .addFields({
      name: m.when,
      value: `${discordTimestamp(night.startsAt, 'F')} (${discordTimestamp(night.startsAt, 'R')})`,
    })
    .setFooter({ text: m.footer(night.id) });
  if (night.location) embed.addFields({ name: m.where, value: night.location, inline: true });
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
    .catch(() => undefined);
}
