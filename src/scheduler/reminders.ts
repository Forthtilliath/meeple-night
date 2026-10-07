import type { BotContext } from '../bot/types.js';
import { discordTimestamp } from '../domain/dates.js';
import {
  attendance,
  DAY_REMINDER_MS,
  type DueReminder,
  dueReminders,
} from '../domain/reminders.js';
import { t } from '../i18n/index.js';
import { log } from '../log.js';
import { getRsvps, markReminderSent, nightsStartingBefore } from '../repositories/nights.js';

const CHECK_INTERVAL_MS = 60_000;

async function sendReminder({ client, db }: BotContext, { night, kind }: DueReminder) {
  const channel = await client.channels.fetch(night.channelId).catch(() => null);
  // Flag it first: a deleted channel or a missing permission must not retry every minute.
  markReminderSent(db, night.id, kind);
  if (!channel?.isSendable() || channel.isDMBased()) return;

  const m = t(channel.guild.preferredLocale).night;
  const people = attendance(getRsvps(db, night.id), night.maxPlayers);
  const when = discordTimestamp(night.startsAt, kind === 'day' ? 't' : 'R');
  const text =
    kind === 'day' ? m.reminderDay(night.title, when) : m.reminderHours(night.title, when);
  const pinged = [...people.confirmed, ...people.maybe];
  const link = night.messageId
    ? `\nhttps://discord.com/channels/${night.guildId}/${night.channelId}/${night.messageId}`
    : '';
  await channel.send({
    content: `${text}${pinged.length > 0 ? `\n${pinged.map((id) => `<@${id}>`).join(' ')}` : ''}${link}`,
    allowedMentions: { users: pinged },
  });
}

export async function checkReminders(ctx: BotContext, now = new Date()): Promise<void> {
  const nights = nightsStartingBefore(ctx.db, now, new Date(now.getTime() + DAY_REMINDER_MS));
  for (const reminder of dueReminders(nights, now)) {
    await sendReminder(ctx, reminder).catch((error) =>
      log.error('Reminder failed', { nightId: reminder.night.id, error }),
    );
  }
}

/** Checks every minute for game nights that need a reminder. Returns a stop function. */
export function startReminderLoop(ctx: BotContext): () => void {
  const tick = () => {
    checkReminders(ctx).catch((error) => log.error('Reminder check failed', { error }));
  };
  tick();
  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  return () => clearInterval(timer);
}
