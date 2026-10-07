import { postInChannel } from '../bot/channels.js';
import type { BotContext } from '../bot/types.js';
import { discordTimestamp } from '../domain/dates.js';
import {
  attendance,
  type DueReminder,
  dueReminders,
  HOUR_MS,
  type ReminderDelays,
} from '../domain/reminders.js';
import { t } from '../i18n/index.js';
import { log } from '../log.js';
import { getSettings, MAX_REMINDER_HOURS } from '../repositories/guilds.js';
import { getRsvps, markReminderSent, nightsStartingBefore } from '../repositories/nights.js';
import { nightUrl } from '../ui/night-message.js';
import { plain } from '../ui/text.js';

const CHECK_INTERVAL_MS = 60_000;

async function sendReminder({ client, db }: BotContext, { night, kind }: DueReminder) {
  const people = attendance(getRsvps(db, night.id), night.maxPlayers);
  const url = nightUrl(night);
  const sent = await postInChannel(
    client,
    night.channelId,
    (locale) => {
      const m = t(locale).night;
      const title = plain(night.title);
      const text =
        kind === 'early'
          ? m.reminderEarly(title, discordTimestamp(night.startsAt, 'F'))
          : m.reminderLate(title, discordTimestamp(night.startsAt, 'R'));
      return url ? `${text}\n${url}` : text;
    },
    [...people.confirmed, ...people.maybe],
  );
  // Transient errors throw before this line, so the reminder is retried on the next tick.
  markReminderSent(db, night.id, kind);
  if (!sent) log.warn('Reminder dropped: channel unavailable', { nightId: night.id });
}

export async function checkReminders(ctx: BotContext, now = new Date()): Promise<void> {
  const until = new Date(now.getTime() + MAX_REMINDER_HOURS * HOUR_MS);
  const nights = nightsStartingBefore(ctx.db, now, until);
  const delays = new Map<string, ReminderDelays>();
  const delaysOf = ({ guildId }: { guildId: string }) => {
    let found = delays.get(guildId);
    if (!found) {
      const settings = getSettings(ctx.db, guildId, ctx.timezone);
      found = { earlyHours: settings.reminderEarlyHours, lateHours: settings.reminderLateHours };
      delays.set(guildId, found);
    }
    return found;
  };
  for (const reminder of dueReminders(nights, now, delaysOf)) {
    await sendReminder(ctx, reminder).catch((error) =>
      log.error('Reminder failed, will retry', { nightId: reminder.night.id, error }),
    );
  }
}

/** Checks every minute for game nights that need a reminder. Returns a stop function. */
export function startReminderLoop(ctx: BotContext): () => void {
  const tick = () => {
    // Before login or while reconnecting, channels can't be fetched: wait for the next tick.
    if (!ctx.client.isReady()) return;
    checkReminders(ctx).catch((error) => log.error('Reminder check failed', { error }));
  };
  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  return () => clearInterval(timer);
}
