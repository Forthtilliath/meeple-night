import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { canManage, type GuildActor, isManager } from '../../src/bot/permissions.js';

function actor(id: string, { manager = false, roles = [] as string[] } = {}): GuildActor {
  return {
    user: { id },
    memberPermissions: new PermissionsBitField(manager ? PermissionFlagsBits.ManageGuild : 0n),
    member: { roles: { cache: new Set(roles) } },
  };
}

describe('permissions', () => {
  it('grants management to Manage Server and to the organizer role', () => {
    expect(isManager(actor('a', { manager: true }))).toBe(true);
    expect(isManager(actor('a', { roles: ['orga'] }), 'orga')).toBe(true);
    expect(isManager(actor('a', { roles: ['orga'] }))).toBe(false);
    expect(isManager(actor('a', { roles: ['other'] }), 'orga')).toBe(false);
  });

  it('lets the author manage their own item', () => {
    expect(canManage(actor('a'), 'a')).toBe(true);
    expect(canManage(actor('b'), 'a')).toBe(false);
    expect(canManage(actor('b', { roles: ['orga'] }), 'a', 'orga')).toBe(true);
  });
});
