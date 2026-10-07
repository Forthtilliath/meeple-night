import type { BotContext } from '../bot/types.js';
import type { Poll } from '../db/schema.js';
import { t } from '../i18n/index.js';
import { log } from '../log.js';
import { serverLocale } from '../repositories/guilds.js';
import { getNight } from '../repositories/nights.js';
import { refreshNightMessage } from './night-message.js';
import { pollResultText, renderPoll } from './poll-message.js';

/** The night message shows the chosen game: refresh it once its vote is closed. */
export async function refreshPollNight({ client, db }: BotContext, poll: Poll): Promise<void> {
  if (!poll.nightId) return;
  const night = getNight(db, poll.guildId, poll.nightId);
  if (night) await refreshNightMessage(client, db, night);
}

/** After an automatic closing: updates the poll message and announces the result. */
export async function announceClosedPoll(ctx: BotContext, poll: Poll): Promise<void> {
  const { client, db } = ctx;
  const channel = await client.channels.fetch(poll.channelId).catch(() => null);
  if (channel?.isSendable() && !channel.isDMBased()) {
    const locale = serverLocale(db, poll.guildId, channel.guild.preferredLocale);
    try {
      if (poll.messageId) {
        await channel.messages.edit(poll.messageId, renderPoll(db, poll, locale));
      }
      const url = poll.messageId
        ? `https://discord.com/channels/${poll.guildId}/${poll.channelId}/${poll.messageId}`
        : '';
      await channel.send({
        content: t(locale).vote.autoClosed(pollResultText(db, poll, locale), url),
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      log.warn('Closed poll not announced', { pollId: poll.id, error });
    }
  }
  await refreshPollNight(ctx, poll);
}
