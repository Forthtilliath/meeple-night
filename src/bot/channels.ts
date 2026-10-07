import type { Client } from 'discord.js';
import type { Db } from '../db/client.js';
import { serverLocale } from '../repositories/guilds.js';
import { isPermanentError } from './discord-errors.js';

/**
 * Posts a message in a guild channel, pinging only `pinged`. The text is composed in the
 * server's language. Returns false when the post can never succeed (channel deleted, access
 * removed); throws on transient errors so the caller may retry.
 */
export async function postInChannel(
  client: Client,
  db: Db,
  channelId: string,
  compose: (locale: string) => string,
  pinged: string[] = [],
): Promise<boolean> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isSendable() || channel.isDMBased()) return false;
    const mentions = pinged.length > 0 ? `\n${pinged.map((id) => `<@${id}>`).join(' ')}` : '';
    const locale = serverLocale(db, channel.guild.id, channel.guild.preferredLocale);
    await channel.send({
      content: `${compose(locale)}${mentions}`,
      allowedMentions: { users: pinged },
    });
    return true;
  } catch (error) {
    if (isPermanentError(error)) return false;
    throw error;
  }
}
