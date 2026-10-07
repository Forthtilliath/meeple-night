import { type GuildActor, isManager } from '../../bot/permissions.js';
import type { ChatInput } from '../../bot/types.js';
import type { Db } from '../../db/client.js';
import type { GameNight } from '../../db/schema.js';
import { attendance, HOUR_MS } from '../../domain/reminders.js';
import type { Messages } from '../../i18n/index.js';
import { getNight, getRsvps } from '../../repositories/nights.js';
import { countOpenPollsBy } from '../../repositories/polls.js';

/** Members without the organizer role can't run more open votes than this. */
export const MAX_OPEN_POLLS_PER_MEMBER = 3;

/** Options shared by every way of starting a vote. */
export interface VoteOptions {
  nightId: number | null;
  players: number | null;
  hours: number | null;
  attendeesOnly: boolean;
}

export function readVoteOptions(interaction: ChatInput): VoteOptions {
  return {
    nightId: interaction.options.getInteger('night'),
    players: interaction.options.getInteger('players'),
    hours: interaction.options.getInteger('hours'),
    attendeesOnly: interaction.options.getBoolean('attendees_only') ?? false,
  };
}

export type VoteCheck =
  | { ok: true; night: GameNight | undefined; players: number | null }
  | { ok: false; error: string };

/**
 * Checks that a member may start this vote. Without an explicit player count, a linked
 * night provides its confirmed attendee count.
 */
export function checkVote(
  db: Db,
  actor: GuildActor,
  guildId: string,
  organizerRoleId: string | null,
  options: VoteOptions,
  m: Messages,
): VoteCheck {
  const night = options.nightId ? getNight(db, guildId, options.nightId) : undefined;
  if (options.nightId && !night) return { ok: false, error: m.common.nightNotFound };
  if (options.attendeesOnly && !night) return { ok: false, error: m.vote.needNight };
  if (
    !isManager(actor, organizerRoleId) &&
    countOpenPollsBy(db, guildId, actor.user.id) >= MAX_OPEN_POLLS_PER_MEMBER
  ) {
    return { ok: false, error: m.vote.tooMany(MAX_OPEN_POLLS_PER_MEMBER) };
  }
  let players = options.players;
  if (!players && night) {
    players = attendance(getRsvps(db, night.id), night.maxPlayers).confirmed.length || null;
  }
  return { ok: true, night, players };
}

/** After the given hours, else at the start of the linked night, else never. */
export function closingTime(
  hours: number | null,
  night: GameNight | undefined,
  now = Date.now(),
): Date | null {
  if (hours) return new Date(now + hours * HOUR_MS);
  return night && night.startsAt.getTime() > now ? night.startsAt : null;
}
