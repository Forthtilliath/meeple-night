import type { BotContext } from '../bot/types.js';
import { log } from '../log.js';
import { handleStartedNights } from './nights.js';
import { checkReminders } from './reminders.js';

const CHECK_INTERVAL_MS = 60_000;

type Job = (ctx: BotContext, now: Date) => Promise<void>;

const JOBS: [string, Job][] = [
  ['reminders', checkReminders],
  ['started nights', handleStartedNights],
];

/** Runs the time-based jobs every minute. Returns a stop function. */
export function startScheduler(ctx: BotContext): () => void {
  let running = false;
  const tick = async () => {
    // Before login or while reconnecting, channels can't be fetched: wait for the next tick.
    if (running || !ctx.client.isReady()) return;
    running = true;
    const now = new Date();
    for (const [name, job] of JOBS) {
      await job(ctx, now).catch((error) => log.error('Scheduled job failed', { job: name, error }));
    }
    running = false;
  };
  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  return () => clearInterval(timer);
}
