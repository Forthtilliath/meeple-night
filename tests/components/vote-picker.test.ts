import {
  type Client,
  ComponentType,
  type Message,
  type MessageComponentInteraction,
  PermissionsBitField,
} from 'discord.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BotContext, RenderedMessage } from '../../src/bot/types.js';
import { votePickerHandler } from '../../src/components/vote-picker.js';
import { createDb, type Db } from '../../src/db/client.js';
import { fitsFilter } from '../../src/domain/voting.js';
import { addGame, archiveGame, listGames } from '../../src/repositories/games.js';
import { getPoll, getPollGames } from '../../src/repositories/polls.js';
import {
  decodePick,
  encodePick,
  type PickParams,
  readSelection,
  renderPicker,
} from '../../src/ui/vote-picker.js';

let db: Db;
let ctx: BotContext;

const params: PickParams = {
  players: 5,
  minDuration: 30,
  maxDuration: 90,
  nightId: null,
  hours: 48,
  attendeesOnly: false,
};

beforeEach(() => {
  db = createDb(':memory:');
  ctx = { client: {} as Client, db, timezone: 'Europe/Paris' };
  for (let i = 1; i <= 30; i++) {
    const title = `Game ${String(i).padStart(2, '0')}`;
    addGame(db, 'g', { title, minPlayers: 2, maxPlayers: 6, minDuration: 45, maxDuration: 60 });
  }
  // Too short for the filter: never listed.
  addGame(db, 'g', {
    title: 'Quick',
    minPlayers: 2,
    maxPlayers: 6,
    minDuration: 10,
    maxDuration: 15,
  });
});

function render(selected: number[]): RenderedMessage {
  const games = listGames(db, 'g').filter((g) => fitsFilter(g, params));
  return renderPicker(games, new Set(selected), params, 'fr');
}

/** What Discord sends back as the message holding the rendered components. */
function asMessage(rendered: RenderedMessage) {
  return {
    components: rendered.components.map((row) => {
      const json = row.toJSON();
      return {
        type: json.type,
        components: json.components.map((c) => ({
          ...c,
          customId: 'custom_id' in c ? c.custom_id : undefined,
        })),
      };
    }),
  };
}

const components = (rendered: RenderedMessage) =>
  asMessage(rendered).components.flatMap((row) => row.components);

const selectionOf = (rendered: RenderedMessage) =>
  readSelection(asMessage(rendered) as unknown as Pick<Message, 'components'>);

const launchDisabled = (rendered: RenderedMessage) =>
  components(rendered).find((c) => c.type === ComponentType.Button)?.disabled;

function interaction(rendered: RenderedMessage, overrides: Record<string, unknown> = {}) {
  return {
    guildId: 'g',
    channelId: 'c',
    locale: 'fr',
    guildLocale: 'fr',
    user: { id: 'u' },
    memberPermissions: new PermissionsBitField(),
    member: { roles: { cache: new Set<string>() } },
    message: asMessage(rendered),
    isStringSelectMenu: () => false,
    reply: vi.fn(async () => undefined),
    update: vi.fn(async () => undefined),
    followUp: vi.fn(async () => ({ id: 'poll-message' })),
    ...overrides,
  } as unknown as MessageComponentInteraction<'cached'> & {
    reply: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    followUp: ReturnType<typeof vi.fn>;
  };
}

describe('vote picker', () => {
  it('round-trips its parameters through the custom ids', () => {
    expect(decodePick(encodePick(params))).toEqual(params);
  });

  it('lists the fitting games in menus of 25, launchable from 2 ticked games', () => {
    const empty = render([]);
    const menus = components(empty).filter((c) => c.type === ComponentType.StringSelect);
    expect(menus.map((c) => ('options' in c ? c.options.length : 0))).toEqual([25, 5]);
    expect(launchDisabled(empty)).toBe(true);

    const two = render([1, 2]);
    expect(launchDisabled(two)).toBe(false);
    expect(selectionOf(two)).toEqual([1, 2]);
  });

  it('keeps the games ticked in the other menu', async () => {
    const before = render([1]);
    const secondMenu = components(before).filter((c) => c.type === ComponentType.StringSelect)[1];
    const click = interaction(before, {
      customId: secondMenu?.customId,
      values: ['28'],
      isStringSelectMenu: () => true,
    });
    await votePickerHandler.handle(click, ['m1', ...encodePick(params)], ctx);
    const after = click.update.mock.calls[0]?.[0] as RenderedMessage;
    expect(selectionOf(after)).toEqual([1, 28]);
  });

  it('starts the vote with the ticked games still in the collection', async () => {
    const ready = render([3, 4, 5]);
    archiveGame(db, 'g', 5);
    const click = interaction(ready);
    await votePickerHandler.handle(click, ['go', ...encodePick(params)], ctx);

    expect(click.update).toHaveBeenCalledWith(expect.objectContaining({ components: [] }));
    expect(click.followUp).toHaveBeenCalledTimes(1);
    const poll = getPoll(db, 1);
    expect(poll).toMatchObject({ messageId: 'poll-message', players: 5 });
    expect(poll?.closesAt).not.toBeNull();
    expect(getPollGames(db, 1).map((g) => g.id)).toEqual([3, 4]);
  });

  it('refuses to start with fewer than 2 games', async () => {
    const click = interaction(render([3]));
    await votePickerHandler.handle(click, ['go', ...encodePick(params)], ctx);
    expect(click.reply).toHaveBeenCalledTimes(1);
    expect(getPoll(db, 1)).toBeUndefined();
  });
});
