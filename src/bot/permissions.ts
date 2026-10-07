import { PermissionFlagsBits, type PermissionsBitField } from 'discord.js';

export interface GuildActor {
  user: { id: string };
  memberPermissions: Readonly<PermissionsBitField>;
  member: { roles: { cache: { has(roleId: string): boolean } } };
}

/** Server managers, plus members holding the organizer role configured with /settings. */
export function isManager(actor: GuildActor, organizerRoleId: string | null = null): boolean {
  return (
    actor.memberPermissions.has(PermissionFlagsBits.ManageGuild) ||
    (organizerRoleId !== null && actor.member.roles.cache.has(organizerRoleId))
  );
}

/** The author of an item, or anyone allowed to manage the server, can edit it. */
export function canManage(
  actor: GuildActor,
  authorId: string,
  organizerRoleId: string | null = null,
): boolean {
  return actor.user.id === authorId || isManager(actor, organizerRoleId);
}
