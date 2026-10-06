import { PermissionFlagsBits, type PermissionsBitField, type User } from 'discord.js';

interface GuildActor {
  user: User;
  memberPermissions: Readonly<PermissionsBitField>;
}

export function isManager(interaction: GuildActor): boolean {
  return interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild);
}

/** The author of an item, or anyone allowed to manage the server, can edit it. */
export function canManage(interaction: GuildActor, authorId: string): boolean {
  return interaction.user.id === authorId || isManager(interaction);
}
