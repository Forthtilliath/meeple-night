import { setTimeout as sleep } from 'node:timers/promises';
import type { Guild } from 'discord.js';
import type { Candidate } from '../domain/play-ranking.js';

export interface NamedMember extends Candidate {
  /** Unambiguous name to show (display name, or username when display names collide). */
  label: string;
}

/**
 * Names of guild members, for forms where people are typed by name. Without the privileged
 * members intent they are fetched one by one; whatever is not back within `timeoutMs` falls
 * back to the cached user, then to the raw id, so a modal can still open in time.
 */
export async function namedMembers(
  guild: Guild,
  userIds: string[],
  timeoutMs = 2000,
): Promise<NamedMember[]> {
  const missing = userIds.filter((id) => !guild.members.cache.has(id));
  if (missing.length > 0) {
    await Promise.race([
      Promise.allSettled(missing.map((id) => guild.members.fetch(id))),
      sleep(timeoutMs, undefined, { ref: false }),
    ]);
  }
  const people = userIds.map((userId) => {
    const member = guild.members.cache.get(userId);
    const user = member?.user ?? guild.client.users.cache.get(userId);
    const display = member?.displayName ?? user?.globalName ?? user?.username ?? userId;
    return { userId, display, username: user?.username ?? userId };
  });
  return people.map(({ userId, display, username }) => {
    const ambiguous = people.filter((p) => p.display.toLowerCase() === display.toLowerCase());
    const label = ambiguous.length > 1 ? username : display;
    return { userId, label, names: [...new Set([label, username, userId])] };
  });
}
