import { syncNightEvent } from '../bot/scheduled-events.js';
import type { BotContext } from '../bot/types.js';
import { nextOccurrence } from '../domain/schedule.js';
import { log } from '../log.js';
import { getSettings } from '../repositories/guilds.js';
import { handleNightStart, nightsToStart, setNightMessage } from '../repositories/nights.js';
import { postNightMessage, refreshNightMessage } from '../ui/night-message.js';

/**
 * Once a night has started: greys out its message (RSVP closed) and, for a recurring night,
 * plans and announces the next occurrence.
 */
export async function handleStartedNights(ctx: BotContext, now = new Date()): Promise<void> {
  const { client, db } = ctx;
  for (const night of nightsToStart(db, now)) {
    const { timezone } = getSettings(db, night.guildId, ctx.timezone);
    const nextStart = night.recurrence
      ? nextOccurrence(night.startsAt, night.recurrence, timezone, now)
      : null;
    const next = handleNightStart(db, night, nextStart);
    await refreshNightMessage(client, db, night);
    if (!next) continue;

    const messageId = await postNightMessage(client, db, next).catch((error) => {
      log.warn('Next occurrence not announced', { nightId: next.id, error });
      return null;
    });
    if (messageId) setNightMessage(db, next.id, messageId);
    await syncNightEvent(client, db, { ...next, messageId });
    log.info('Next occurrence planned', { nightId: next.id, previous: night.id });
  }
}
