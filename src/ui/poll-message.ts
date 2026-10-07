import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type MessageActionRowComponentBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { customId, type RenderedMessage } from '../bot/types.js';
import type { Db } from '../db/client.js';
import type { Poll } from '../db/schema.js';
import { tally, winners } from '../domain/voting.js';
import { t } from '../i18n/index.js';
import { getPollGames, getVotes } from '../repositories/polls.js';
import { plain } from './text.js';

export const POLL_PREFIX = 'poll';

const COLOR_OPEN = 0xfee75c;
const COLOR_CLOSED = 0x57f287;
const LABEL_LIMIT = 100;

const clip = (text: string) =>
  text.length > LABEL_LIMIT ? `${text.slice(0, LABEL_LIMIT - 1)}…` : text;

/** Builds the poll message: live tally, then the winner once closed. */
export function renderPoll(db: Db, poll: Poll, locale: string): RenderedMessage {
  const m = t(locale);
  const games = getPollGames(db, poll.id);
  const votes = getVotes(db, poll.id);
  const results = tally(
    games.map((g) => g.id),
    votes,
  );
  const titleOf = new Map(games.map((g) => [g.id, plain(g.title)]));
  const open = poll.status === 'open';

  const lines = results.map(
    ({ gameId, votes: count }) => `**${titleOf.get(gameId)}** — ${m.vote.voteCount(count)}`,
  );
  const embed = new EmbedBuilder()
    .setTitle(open ? m.vote.title : m.vote.closedTitle)
    .setColor(open ? COLOR_OPEN : COLOR_CLOSED)
    .setDescription(
      [open ? m.vote.description(poll.players) : '', ...lines].filter(Boolean).join('\n'),
    )
    .setFooter({ text: m.vote.voters(new Set(votes.map((v) => v.userId)).size) });

  if (!open) {
    const best = winners(results).map((id) => titleOf.get(id));
    embed.addFields({
      name: '​',
      value: best.length > 0 ? m.vote.winner(best.join(' / ')) : m.vote.noVotes,
    });
    return { embeds: [embed], components: [] };
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(customId(POLL_PREFIX, poll.id, 'select'))
    .setPlaceholder(m.vote.placeholder)
    .setMinValues(0)
    .setMaxValues(games.length)
    .addOptions(
      games.map((g) => ({
        label: clip(g.title),
        value: String(g.id),
        description: clip(
          `${m.common.players(g.minPlayers, g.maxPlayers)} · ${m.common.duration(g.minDuration, g.maxDuration)}`,
        ),
      })),
    );
  const close = new ButtonBuilder()
    .setCustomId(customId(POLL_PREFIX, poll.id, 'close'))
    .setLabel(m.vote.close)
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(select),
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(close),
    ],
  };
}
