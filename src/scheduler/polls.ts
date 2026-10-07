import type { BotContext } from '../bot/types.js';
import { duePolls, finalizePoll } from '../repositories/polls.js';
import { announceClosedPoll } from '../ui/poll-closing.js';

/** Closes the votes whose closing time has come, and announces their result. */
export async function closeDuePolls(ctx: BotContext, now = new Date()): Promise<void> {
  for (const poll of duePolls(ctx.db, now)) {
    await announceClosedPoll(ctx, finalizePoll(ctx.db, poll));
  }
}
