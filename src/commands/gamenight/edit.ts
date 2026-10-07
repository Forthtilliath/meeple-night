import { MessageFlags } from 'discord.js';
import { canManage } from '../../bot/permissions.js';
import { syncNightEvent } from '../../bot/scheduled-events.js';
import type { BotContext, ChatInput } from '../../bot/types.js';
import { discordTimestamp, localDateTime, parseLocalDateTime } from '../../domain/dates.js';
import { attendance, interestedUsers, promotedUsers } from '../../domain/reminders.js';
import { t } from '../../i18n/index.js';
import type { GuildSettings } from '../../repositories/guilds.js';
import { getNight, getRsvps, type NightPatch, updateNight } from '../../repositories/nights.js';
import { isOpen, notifyNight, refreshNightMessage } from '../../ui/night-message.js';
import { plain } from '../../ui/text.js';

export async function editNightCommand(
  interaction: ChatInput,
  { client, db }: BotContext,
  settings: GuildSettings,
): Promise<void> {
  const m = t(interaction.locale);
  const reply = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
  const options = interaction.options;

  const night = getNight(db, interaction.guildId, options.getInteger('night', true));
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

  const patch: NightPatch = {};
  const title = options.getString('title');
  if (title) patch.title = title;
  const location = options.getString('location');
  if (location) patch.location = location;
  const maxPlayers = options.getInteger('max_players');
  if (maxPlayers !== null) patch.maxPlayers = maxPlayers === 0 ? null : maxPlayers;

  const date = options.getString('date');
  const time = options.getString('time');
  if (date || time) {
    // Only one of them may be given: the other keeps its current local value.
    const current = localDateTime(night.startsAt, settings.timezone);
    const startsAt = parseLocalDateTime(
      date ?? current.date,
      time ?? current.time,
      settings.timezone,
    );
    if (!startsAt) {
      await reply(m.night.invalidDate);
      return;
    }
    if (startsAt <= new Date()) {
      await reply(m.night.pastDate);
      return;
    }
    if (startsAt.getTime() !== night.startsAt.getTime()) patch.startsAt = startsAt;
  }
  if (Object.keys(patch).length === 0) {
    await reply(m.night.nothingToEdit);
    return;
  }

  const before = attendance(getRsvps(db, night.id), night.maxPlayers);
  const updated = updateNight(db, night.id, patch);
  const after = attendance(getRsvps(db, night.id), updated.maxPlayers);
  await reply(m.night.edited);
  await refreshNightMessage(client, db, updated);
  await syncNightEvent(client, db, updated);

  if (patch.startsAt || patch.location) {
    await notifyNight(
      client,
      updated,
      (locale) =>
        t(locale).night.noticeChanged(
          plain(updated.title),
          discordTimestamp(updated.startsAt, 'F'),
          updated.location ? plain(updated.location) : null,
        ),
      interestedUsers(after),
    );
  }
  const promoted = promotedUsers(before, after);
  if (promoted.length > 0) {
    await notifyNight(
      client,
      updated,
      (locale) => t(locale).night.noticePromoted(plain(updated.title)),
      promoted,
    );
  }
}
