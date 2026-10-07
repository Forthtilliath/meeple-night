import { MessageFlags } from 'discord.js';
import { isManager } from '../../bot/permissions.js';
import { syncNightEvent } from '../../bot/scheduled-events.js';
import type { BotContext, ChatInput } from '../../bot/types.js';
import type { Recurrence } from '../../db/schema.js';
import { parseLocalDateTime } from '../../domain/dates.js';
import { t } from '../../i18n/index.js';
import type { GuildSettings } from '../../repositories/guilds.js';
import { countUpcomingNightsBy, createNight, setNightMessage } from '../../repositories/nights.js';
import { renderNight } from '../../ui/night-message.js';

/** Members without the organizer role can't flood the server with nights. */
export const MAX_UPCOMING_PER_MEMBER = 5;

export async function createNightCommand(
  interaction: ChatInput,
  { client, db }: BotContext,
  settings: GuildSettings,
): Promise<void> {
  const m = t(interaction.locale);
  const reply = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

  const startsAt = parseLocalDateTime(
    interaction.options.getString('date', true),
    interaction.options.getString('time', true),
    settings.timezone,
  );
  if (!startsAt) {
    await reply(m.night.invalidDate);
    return;
  }
  const now = new Date();
  if (startsAt <= now) {
    await reply(m.night.pastDate);
    return;
  }
  if (
    !isManager(interaction, settings.organizerRoleId) &&
    countUpcomingNightsBy(db, interaction.guildId, interaction.user.id, now) >=
      MAX_UPCOMING_PER_MEMBER
  ) {
    await reply(m.night.tooMany(MAX_UPCOMING_PER_MEMBER));
    return;
  }

  const night = createNight(db, {
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    title: interaction.options.getString('title', true),
    location: interaction.options.getString('location'),
    startsAt,
    maxPlayers: interaction.options.getInteger('max_players'),
    createdBy: interaction.user.id,
    recurrence: interaction.options.getString('repeat') as Recurrence | null,
  });
  const response = await interaction.reply({
    ...renderNight(db, night, settings.locale ?? interaction.guildLocale),
    withResponse: true,
  });
  const messageId = response.resource?.message?.id ?? null;
  if (messageId) setNightMessage(db, night.id, messageId);
  await syncNightEvent(client, db, { ...night, messageId });
}
