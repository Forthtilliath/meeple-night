import type { Interaction } from 'discord.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRouter } from '../../src/bot/router.js';
import type { BotContext, Command, ComponentHandler, ModalHandler } from '../../src/bot/types.js';

type Kind = 'command' | 'autocomplete' | 'component' | 'modal';

function fake(kind: Kind, overrides: Record<string, unknown> = {}) {
  return {
    locale: 'fr',
    guildId: 'g',
    user: { id: 'u' },
    commandName: 'test',
    customId: 'thing:1:two',
    replied: false,
    deferred: false,
    inCachedGuild: () => true,
    isRepliable: () => kind !== 'autocomplete',
    isChatInputCommand: () => kind === 'command',
    isAutocomplete: () => kind === 'autocomplete',
    isMessageComponent: () => kind === 'component',
    isModalSubmit: () => kind === 'modal',
    reply: vi.fn(async () => undefined),
    followUp: vi.fn(async () => undefined),
    ...overrides,
  };
}

const ctx = {} as BotContext;

function setup() {
  const command = {
    data: { name: 'test', toJSON: () => ({}) },
    execute: vi.fn(async () => undefined),
    autocomplete: vi.fn(async () => undefined),
  } as unknown as Command & { execute: ReturnType<typeof vi.fn> };
  const component = { prefix: 'thing', handle: vi.fn(async () => undefined) };
  const modal = { prefix: 'thing', handle: vi.fn(async () => undefined) };
  const route = createRouter([command], [component as ComponentHandler], ctx, [
    modal as ModalHandler,
  ]);
  return {
    command,
    component,
    modal,
    route: (i: ReturnType<typeof fake>) => route(i as unknown as Interaction),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('router', () => {
  it('refuses interactions outside a server', async () => {
    const { route, command } = setup();
    const interaction = fake('command', { inCachedGuild: () => false });
    await route(interaction);
    expect(command.execute).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('serveur') }),
    );
  });

  it('dispatches commands, autocompletes, components and modals', async () => {
    const { route, command, component, modal } = setup();
    await route(fake('command'));
    await route(fake('autocomplete'));
    await route(fake('component'));
    await route(fake('modal'));
    expect(command.execute).toHaveBeenCalledTimes(1);
    expect(command.autocomplete).toHaveBeenCalledTimes(1);
    expect(component.handle).toHaveBeenCalledWith(expect.anything(), ['1', 'two'], ctx);
    expect(modal.handle).toHaveBeenCalledWith(expect.anything(), ['1', 'two'], ctx);
  });

  it('ignores unknown commands and prefixes', async () => {
    const { route } = setup();
    const interaction = fake('component', { customId: 'nope:1' });
    await route(interaction);
    await route(fake('command', { commandName: 'nope' }));
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('logs failures and answers privately, as a follow-up once replied', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { route, command } = setup();
    command.execute.mockRejectedValue(new Error('boom'));

    const fresh = fake('command');
    await route(fresh);
    expect(fresh.reply).toHaveBeenCalledWith(expect.objectContaining({ flags: 64 }));

    const deferred = fake('command', { deferred: true });
    await route(deferred);
    expect(deferred.followUp).toHaveBeenCalledTimes(1);
    expect(deferred.reply).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
