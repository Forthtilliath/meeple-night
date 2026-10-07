import { type ButtonInteraction, type Client, RESTJSONErrorCodes } from 'discord.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../src/bot/types.js';
import type { RenewalConfig } from '../src/config.js';
import { createDb } from '../src/db/client.js';
import { HOUR_MS } from '../src/domain/reminders.js';
import { checkRenewal, confirmRenewal, RENEWAL_DONE_ID } from '../src/renewal.js';
import { discordError } from './helpers/discord.js';

const start = new Date('2026-10-07T12:00:00Z');
const at = (hours: number) => new Date(start.getTime() + hours * HOUR_MS);
const renewal: RenewalConfig = {
  userId: '123456789012345678',
  days: 4,
  url: 'https://dashboard.example.com',
  locale: 'fr',
};

afterEach(() => {
  vi.restoreAllMocks();
});

function setup(send: (message: unknown) => Promise<unknown> = async () => undefined) {
  const user = { send: vi.fn(send) };
  const client = { users: { fetch: vi.fn(async () => user) } } as unknown as Client;
  const ctx: BotContext = { client, db: createDb(':memory:'), timezone: 'Europe/Paris' };
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  return { ctx, send: user.send };
}

function button(userId = renewal.userId) {
  return {
    user: { id: userId },
    update: vi.fn(async () => undefined),
    deferUpdate: vi.fn(async () => undefined),
  };
}

describe('checkRenewal', () => {
  it('starts tracking on the first run, then reminds a day before the deadline', async () => {
    const { ctx, send } = setup();
    await checkRenewal(ctx, renewal, start);
    await checkRenewal(ctx, renewal, at(71));
    expect(send).not.toHaveBeenCalled();

    await checkRenewal(ctx, renewal, at(72));
    await checkRenewal(ctx, renewal, at(73));
    expect(send).toHaveBeenCalledTimes(1);
    const message = send.mock.calls[0]?.[0] as { content: string; components: unknown[] };
    expect(message.content).toContain(`<t:${at(96).getTime() / 1000}:F>`);
    const [buttons] = message.components.map((row) => JSON.stringify(row));
    expect(buttons).toContain(RENEWAL_DONE_ID);
    expect(buttons).toContain(renewal.url);
  });

  it('starts a new cycle once the renewal is confirmed', async () => {
    const { ctx, send } = setup();
    await checkRenewal(ctx, renewal, start);
    await checkRenewal(ctx, renewal, at(72));

    const stranger = button('999999999999999999');
    await confirmRenewal(stranger as unknown as ButtonInteraction, ctx, renewal, at(74));
    expect(stranger.deferUpdate).toHaveBeenCalled();

    const owner = button();
    await confirmRenewal(owner as unknown as ButtonInteraction, ctx, renewal, at(75));
    expect(owner.update).toHaveBeenCalledWith({
      content: `✅ Renouvellement noté. Prochain rappel <t:${at(75 + 72).getTime() / 1000}:R>.`,
      components: [],
    });

    await checkRenewal(ctx, renewal, at(90));
    expect(send).toHaveBeenCalledTimes(1);
    await checkRenewal(ctx, renewal, at(75 + 72));
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('retries after a transient error but not when the user is unreachable', async () => {
    const transient = setup(async () => {
      throw new Error('network');
    });
    await checkRenewal(transient.ctx, renewal, start);
    await expect(checkRenewal(transient.ctx, renewal, at(72))).rejects.toThrow('network');
    await expect(checkRenewal(transient.ctx, renewal, at(73))).rejects.toThrow('network');

    const closed = setup(async () => {
      throw discordError(RESTJSONErrorCodes.CannotSendMessagesToThisUser);
    });
    await checkRenewal(closed.ctx, renewal, start);
    await checkRenewal(closed.ctx, renewal, at(72));
    await checkRenewal(closed.ctx, renewal, at(73));
    expect(closed.send).toHaveBeenCalledTimes(1);
  });
});
