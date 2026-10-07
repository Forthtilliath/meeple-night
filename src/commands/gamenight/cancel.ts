import { MessageFlags } from 'discord.js';
import { canManage } from '../../bot/permissions.js';
import { deleteNightEvent } from '../../bot/scheduled-events.js';
import type { BotContext, ChatInput } from '../../bot/types.js';
import { discordTimestamp } from '../../domain/dates.js';
import { attendance, interestedUsers } from '../../domain/reminders.js';
import { t } from '../../i18n/index.js';
import type { GuildSettings } from '../../repositories/guilds.js';
import { cancelNight, getNight, getRsvps, updateNight } from '../../repositories/nights.js';
import { isOpen, notifyNight, refreshNightMessage } from '../../ui/night-message.js';
import { plain } from '../../ui/text.js';

export async function cancelNightCommand(
  interaction: ChatInput,
  { client, db }: BotContext,
  settings: GuildSettings,
): Promise<void> {
  const m = t(interaction.locale);
  const reply = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

  const night = getNight(db, interaction.guildId, interaction.options.getInteger('night', true));
  if (!night) {
    await reply(m.common.nightNotFound);
    return;
  }
  if (!canManage(interaction, night.createdBy, settings.organizerRoleId)) {
    await reply(m.common.noPermission);
    return;
  }
  if (!isOpen(night)) {
    await reply(m.night.closed);
    return;
  }

  cancelNight(db, night.id);
  // A cancelled occurrence keeps its series going, unless asked otherwise.
  const stopSeries = interaction.options.getBoolean('stop_series') ?? false;
  const cancelled = stopSeries
    ? updateNight(db, night.id, { recurrence: null })
    : { ...night, status: 'cancelled' as const };
  await reply(m.night.cancelled);
  await refreshNightMessage(client, db, cancelled);
  await deleteNightEvent(client, db, cancelled);
  await notifyNight(
    client,
    db,
    cancelled,
    (locale) =>
      t(locale).night.noticeCancelled(plain(night.title), discordTimestamp(night.startsAt, 'F')),
    interestedUsers(attendance(getRsvps(db, night.id), night.maxPlayers)),
  );
}
