import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  type Message,
  type MessageActionRowComponentBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { customId, type RenderedMessage } from '../bot/types.js';
import type { Game } from '../db/schema.js';
import type { CandidateFilter } from '../domain/voting.js';
import { t } from '../i18n/index.js';
import { plain } from './text.js';

export const VOTE_PICK_PREFIX = 'vpick';
/** A vote offers its games in a single select menu, hence at most 25 of them. */
export const MAX_POLL_GAMES = 25;

const MENU_SIZE = 25;
/** Discord allows 5 rows: 4 menus, then the launch button. */
const MAX_MENUS = 4;
export const MAX_LISTED = MENU_SIZE * MAX_MENUS;

const LABEL_LIMIT = 100;
const PLACEHOLDER_LIMIT = 150;
const FIELD_LIMIT = 1024;

const clip = (text: string, limit: number) =>
  text.length > limit ? `${text.slice(0, limit - 1)}…` : text;

/** Filters and vote options, carried by the custom ids so the picker stays stateless. */
export interface PickParams extends CandidateFilter {
  players: number | null;
  minDuration: number | null;
  maxDuration: number | null;
  nightId: number | null;
  hours: number | null;
  attendeesOnly: boolean;
}

const encode = (value: number | null) => (value ? String(value) : '');
const decode = (value = '') => Number(value) || null;

export function encodePick(p: PickParams): string[] {
  return [
    encode(p.players),
    encode(p.minDuration),
    encode(p.maxDuration),
    encode(p.nightId),
    encode(p.hours),
    p.attendeesOnly ? '1' : '',
  ];
}

export function decodePick([
  players,
  minDuration,
  maxDuration,
  nightId,
  hours,
  attendees,
]: string[]): PickParams {
  return {
    players: decode(players),
    minDuration: decode(minDuration),
    maxDuration: decode(maxDuration),
    nightId: decode(nightId),
    hours: decode(hours),
    attendeesOnly: attendees === '1',
  };
}

/** Game ids ticked in the picker's menus, except in the one being changed. */
export function readSelection(message: Pick<Message, 'components'>, skipCustomId = ''): number[] {
  const ids: number[] = [];
  for (const row of message.components) {
    if (row.type !== ComponentType.ActionRow) continue;
    for (const component of row.components) {
      if (component.type !== ComponentType.StringSelect || component.customId === skipCustomId) {
        continue;
      }
      for (const option of component.options) if (option.default) ids.push(Number(option.value));
    }
  }
  return ids;
}

/** The ephemeral picker: matching games split into menus, then the launch button. */
export function renderPicker(
  games: Game[],
  selected: Set<number>,
  params: PickParams,
  locale: string,
): RenderedMessage {
  const { common, vote: m } = t(locale);
  const listed = games.slice(0, MAX_LISTED);
  const chosen = games.filter((g) => selected.has(g.id));
  const intro = [m.pickIntro(games.length, MAX_POLL_GAMES)];
  if (games.length > MAX_LISTED) intro.push(m.pickTruncated(MAX_LISTED));

  const embed = new EmbedBuilder()
    .setTitle(m.pickTitle)
    .setDescription(intro.join('\n'))
    .addFields({
      name: m.pickSelection(chosen.length),
      value: clip(chosen.map((g) => plain(g.title)).join(', ') || m.pickNone, FIELD_LIMIT),
    });

  const args = encodePick(params);
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
  for (let start = 0; start < listed.length; start += MENU_SIZE) {
    const chunk = listed.slice(start, start + MENU_SIZE);
    const placeholder =
      listed.length <= MENU_SIZE
        ? m.pickPlaceholder
        : `${chunk[0]?.title} → ${chunk[chunk.length - 1]?.title}`;
    const menu = new StringSelectMenuBuilder()
      .setCustomId(customId(VOTE_PICK_PREFIX, `m${start / MENU_SIZE}`, ...args))
      .setPlaceholder(clip(placeholder, PLACEHOLDER_LIMIT))
      .setMinValues(0)
      .setMaxValues(chunk.length)
      .addOptions(
        chunk.map((g) => ({
          label: clip(g.title, LABEL_LIMIT),
          value: String(g.id),
          description: clip(
            `${common.players(g.minPlayers, g.maxPlayers)} · ${common.duration(g.minDuration, g.maxDuration)}`,
            LABEL_LIMIT,
          ),
          default: selected.has(g.id),
        })),
      );
    rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu));
  }

  const launch = new ButtonBuilder()
    .setCustomId(customId(VOTE_PICK_PREFIX, 'go', ...args))
    .setLabel(m.pickLaunch(chosen.length))
    .setStyle(ButtonStyle.Primary)
    .setDisabled(chosen.length < 2 || chosen.length > MAX_POLL_GAMES);
  rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(launch));

  return { embeds: [embed], components: rows };
}
