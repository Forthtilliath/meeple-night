import {
  type Client,
  type Guild,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  PermissionFlagsBits,
} from 'discord.js';
import type { Db } from '../db/client.js';
import type { GameNight } from '../db/schema.js';
import { nightEnd } from '../domain/schedule.js';
import { log } from '../log.js';
import { updateNight } from '../repositories/nights.js';
import { nightUrl } from '../ui/night-message.js';
import { isPermanentError } from './discord-errors.js';

const LOCATION_LIMIT = 100;

/** Events are optional: the bot only mirrors nights where it was granted the permission. */
function canUseEvents(guild: Guild): boolean {
  return Boolean(
    guild.members.me?.permissions.any([
      PermissionFlagsBits.CreateEvents,
      PermissionFlagsBits.ManageEvents,
    ]),
  );
}

function eventDetails(night: GameNight) {
  const url = nightUrl(night);
  return {
    name: night.title,
    scheduledStartTime: night.startsAt,
    scheduledEndTime: nightEnd(night.startsAt),
    entityMetadata: { location: (night.location ?? url ?? 'Discord').slice(0, LOCATION_LIMIT) },
    description: url ?? undefined,
  };
}

/**
 * Creates or updates the Discord scheduled event mirroring an upcoming night, and stores its
 * id. Best effort: a failure is logged and never blocks the night itself.
 */
export async function syncNightEvent(client: Client, db: Db, night: GameNight): Promise<void> {
  const guild = client.guilds.cache.get(night.guildId);
  if (!guild || !canUseEvents(guild) || night.status !== 'scheduled') return;
  if (night.startsAt <= new Date()) return;
  try {
    let eventId: string | null = null;
    if (night.scheduledEventId) {
      const edited = await guild.scheduledEvents
        .edit(night.scheduledEventId, eventDetails(night))
        .catch((error) => {
          // Deleted by hand in Discord: recreate it below.
          if (isPermanentError(error)) return null;
          throw error;
        });
      eventId = edited?.id ?? null;
    }
    if (!eventId) {
      const created = await guild.scheduledEvents.create({
        ...eventDetails(night),
        privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
        entityType: GuildScheduledEventEntityType.External,
      });
      eventId = created.id;
    }
    if (eventId !== night.scheduledEventId) {
      updateNight(db, night.id, { scheduledEventId: eventId });
    }
  } catch (error) {
    log.warn('Scheduled event not synced', { nightId: night.id, error });
  }
}

export async function deleteNightEvent(client: Client, db: Db, night: GameNight): Promise<void> {
  if (!night.scheduledEventId) return;
  const guild = client.guilds.cache.get(night.guildId);
  try {
    await guild?.scheduledEvents.delete(night.scheduledEventId);
  } catch (error) {
    if (!isPermanentError(error)) {
      log.warn('Scheduled event not deleted', { nightId: night.id, error });
      return;
    }
  }
  updateNight(db, night.id, { scheduledEventId: null });
}
