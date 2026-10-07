import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { customId, type RenderedMessage } from '../bot/types.js';
import type { Game } from '../db/schema.js';
import type { CandidateFilter } from '../domain/voting.js';
import { t } from '../i18n/index.js';
import { plain } from './text.js';

export const COLLECTION_PAGE_PREFIX = 'colpage';
export const PAGE_SIZE = 20;

const encode = (value: number | null | undefined) => (value ? String(value) : '');

/** Reads back the filter stored in a page button's custom id. */
export function decodeFilter(players = '', maxDuration = ''): CandidateFilter {
  return { players: Number(players) || null, maxDuration: Number(maxDuration) || null };
}

/** One page of the collection; the buttons carry the filter so they keep working statelessly. */
export function renderCollectionPage(
  games: Game[],
  requestedPage: number,
  filter: CandidateFilter,
  locale: string,
): RenderedMessage {
  const m = t(locale);
  const pages = Math.max(1, Math.ceil(games.length / PAGE_SIZE));
  const page = Math.min(Math.max(requestedPage, 0), pages - 1);
  const lines = games
    .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    .map(
      (g) =>
        `**${plain(g.title)}** · ${m.common.players(g.minPlayers, g.maxPlayers)} · ${m.common.duration(g.minDuration, g.maxDuration)}`,
    );
  const embed = new EmbedBuilder()
    .setTitle(m.collection.listTitle(games.length))
    .setDescription(lines.join('\n'));
  if (pages === 1) return { embeds: [embed], components: [] };

  embed.setFooter({ text: m.collection.page(page + 1, pages) });
  // The trailing tag keeps both custom ids distinct, as Discord requires.
  const button = (target: number, label: string, emoji: string, tag: string) =>
    new ButtonBuilder()
      .setCustomId(
        customId(
          COLLECTION_PAGE_PREFIX,
          target,
          encode(filter.players),
          encode(filter.maxDuration),
          tag,
        ),
      )
      .setLabel(label)
      .setEmoji(emoji)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(target < 0 || target >= pages);
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        button(page - 1, m.collection.previous, '◀️', 'prev'),
        button(page + 1, m.collection.next, '▶️', 'next'),
      ),
    ],
  };
}
