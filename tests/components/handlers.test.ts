import {
  type Client,
  type MessageComponentInteraction,
  PermissionFlagsBits,
  PermissionsBitField,
} from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../../src/bot/types.js';
import { pollHandler } from '../../src/components/poll.js';
import { rsvpHandler } from '../../src/components/rsvp.js';
import { createDb, type Db } from '../../src/db/client.js';
import { addGame } from '../../src/repositories/games.js';
import { createNight, getNight, getRsvps, setRsvp } from '../../src/repositories/nights.js';
import { createPoll, getPoll, getVotes } from '../../src/repositories/polls.js';
import { fakeChannel } from '../helpers/discord.js';

let db: Db;
let ctx: BotContext;
let sent: ReturnType<typeof fakeChannel>['sent'];

beforeEach(() => {
  db = createDb(':memory:');
  const channel = fakeChannel();
  sent = channel.sent;
  const client = { channels: { fetch: async () => channel.channel } } as unknown as Client;
  ctx = { client, db, timezone: 'Europe/Paris' };
});

afterEach(() => {
  vi.restoreAllMocks();
});

function interaction(userId: string, overrides: Record<string, unknown> = {}) {
  return {
    guildId: 'g',
    locale: 'fr',
    guildLocale: 'fr',
    user: { id: userId },
    memberPermissions: new PermissionsBitField(),
    member: { roles: { cache: new Set<string>() } },
    isStringSelectMenu: () => false,
    reply: vi.fn(async () => undefined),
    update: vi.fn(async () => undefined),
    followUp: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as MessageComponentInteraction<'cached'> & {
    reply: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

const night = (maxPlayers: number | null = null) =>
  createNight(db, {
    guildId: 'g',
    channelId: 'c',
    title: 'Night',
    location: null,
    startsAt: new Date(Date.now() + 86_400_000),
    maxPlayers,
    createdBy: 'organizer',
  });

describe('rsvp buttons', () => {
  it('saves the answer and announces a promotion from the waitlist', async () => {
    const { id } = night(1);
    await rsvpHandler.handle(interaction('a'), [String(id), 'yes'], ctx);
    await rsvpHandler.handle(interaction('b'), [String(id), 'yes'], ctx);
    expect(sent).toEqual([]);

    const leaving = interaction('a');
    await rsvpHandler.handle(leaving, [String(id), 'no'], ctx);
    expect(leaving.update).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.allowedMentions).toEqual({ users: ['b'] });
  });

  it('rejects unknown answers and closed nights', async () => {
    const { id } = night();
    const bad = interaction('a');
    await rsvpHandler.handle(bad, [String(id), 'perhaps'], ctx);
    await rsvpHandler.handle(bad, ['999', 'yes'], ctx);
    expect(bad.reply).toHaveBeenCalledTimes(2);
    expect(getRsvps(db, id)).toEqual([]);
  });
});

describe('poll menu', () => {
  function setupPoll() {
    const target = night();
    setRsvp(db, target.id, 'attendee', 'yes');
    const gameIds = ['Azul', 'Splendor'].map(
      (title) =>
        addGame(db, 'g', { title, minPlayers: 2, maxPlayers: 4, minDuration: 30, maxDuration: 30 })
          ?.id ?? 0,
    );
    const poll = createPoll(db, {
      guildId: 'g',
      channelId: 'c',
      nightId: target.id,
      players: null,
      createdBy: 'organizer',
      gameIds,
      attendeesOnly: true,
    });
    return { poll, gameIds, nightId: target.id };
  }

  const select = (userId: string, values: string[]) =>
    interaction(userId, { isStringSelectMenu: () => true, values });

  it('only lets confirmed attendees vote, ignoring foreign options', async () => {
    const { poll, gameIds } = setupPoll();
    const outsider = select('outsider', [String(gameIds[0])]);
    await pollHandler.handle(outsider, [String(poll.id), 'select'], ctx);
    expect(outsider.update).not.toHaveBeenCalled();

    const voter = select('attendee', [String(gameIds[0]), '999']);
    await pollHandler.handle(voter, [String(poll.id), 'select'], ctx);
    expect(voter.update).toHaveBeenCalledTimes(1);
    expect(getVotes(db, poll.id)).toEqual([{ userId: 'attendee', gameId: gameIds[0] }]);
  });

  it('lets only the author or a manager close it, then sets the night game', async () => {
    const { poll, gameIds, nightId } = setupPoll();
    await pollHandler.handle(
      select('attendee', [String(gameIds[1])]),
      [String(poll.id), 'select'],
      ctx,
    );

    const stranger = interaction('stranger');
    await pollHandler.handle(stranger, [String(poll.id), 'close'], ctx);
    expect(getPoll(db, poll.id)?.status).toBe('open');

    const manager = interaction('admin', {
      memberPermissions: new PermissionsBitField(PermissionFlagsBits.ManageGuild),
    });
    await pollHandler.handle(manager, [String(poll.id), 'close'], ctx);
    expect(getPoll(db, poll.id)).toMatchObject({ status: 'closed', winnerGameId: gameIds[1] });
    expect(getNight(db, 'g', nightId)?.gameId).toBe(gameIds[1]);

    const late = select('attendee', [String(gameIds[0])]);
    await pollHandler.handle(late, [String(poll.id), 'select'], ctx);
    expect(late.update).not.toHaveBeenCalled();
  });
});
