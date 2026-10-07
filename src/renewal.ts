import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  DiscordAPIError,
  type Interaction,
  type MessageActionRowComponentBuilder,
  RESTJSONErrorCodes,
} from 'discord.js';
import type { BotContext } from './bot/types.js';
import type { RenewalConfig } from './config.js';
import { discordTimestamp } from './domain/dates.js';
import { firstRenewalReminder, isRenewalReminderDue, renewalDeadline } from './domain/renewal.js';
import { t } from './i18n/index.js';
import { log } from './log.js';
import { getDateState, setDateState } from './repositories/bot-state.js';

const RENEWED_KEY = 'renewal.renewed_at';
const REMINDED_KEY = 'renewal.reminded_at';
const CHECK_INTERVAL_MS = 10 * 60_000;
export const RENEWAL_DONE_ID = 'renewal:done';

/** The reminder can never reach the user: retrying every few minutes would only flood the logs. */
const UNREACHABLE = new Set<unknown>([
  RESTJSONErrorCodes.CannotSendMessagesToThisUser,
  RESTJSONErrorCodes.UnknownUser,
]);

function renewalMessage(renewal: RenewalConfig, deadline: Date) {
  const m = t(renewal.locale).renewal;
  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId(RENEWAL_DONE_ID).setLabel(m.done).setStyle(ButtonStyle.Success),
  );
  if (renewal.url) {
    row.addComponents(
      new ButtonBuilder().setLabel(m.open).setStyle(ButtonStyle.Link).setURL(renewal.url),
    );
  }
  return {
    content: m.reminder(discordTimestamp(deadline, 'F'), discordTimestamp(deadline, 'R')),
    components: [row],
  };
}

/** Sends the reminder by direct message when due. The first run counts as a renewal. */
export async function checkRenewal(
  { client, db }: BotContext,
  renewal: RenewalConfig,
  now = new Date(),
): Promise<void> {
  const renewedAt = getDateState(db, RENEWED_KEY);
  if (!renewedAt) {
    setDateState(db, RENEWED_KEY, now);
    log.info('Renewal tracking started', { deadline: renewalDeadline(now, renewal.days) });
    return;
  }
  if (!isRenewalReminderDue(renewedAt, getDateState(db, REMINDED_KEY), renewal.days, now)) return;
  try {
    const user = await client.users.fetch(renewal.userId);
    await user.send(renewalMessage(renewal, renewalDeadline(renewedAt, renewal.days)));
  } catch (error) {
    if (!(error instanceof DiscordAPIError && UNREACHABLE.has(error.code))) throw error;
    log.warn('Renewal reminder dropped: user unreachable', { userId: renewal.userId });
  }
  setDateState(db, REMINDED_KEY, now);
}

/** Checks every 10 minutes whether the renewal reminder is due. Returns a stop function. */
export function startRenewalReminder(ctx: BotContext, renewal: RenewalConfig): () => void {
  const run = () => {
    if (!ctx.client.isReady()) return;
    checkRenewal(ctx, renewal).catch((error) =>
      log.error('Renewal reminder failed, will retry', { error }),
    );
  };
  const timer = setInterval(run, CHECK_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}

/** The reminder's button is clicked in direct messages, where the guild router does not go. */
export function isRenewalButton(interaction: Interaction): interaction is ButtonInteraction {
  return interaction.isButton() && interaction.customId === RENEWAL_DONE_ID;
}

/** "Renewed" button: starts a new cycle and tells when the next reminder comes. */
export async function confirmRenewal(
  interaction: ButtonInteraction,
  { db }: BotContext,
  renewal: RenewalConfig,
  now = new Date(),
): Promise<void> {
  if (interaction.user.id !== renewal.userId) {
    await interaction.deferUpdate();
    return;
  }
  setDateState(db, RENEWED_KEY, now);
  const next = firstRenewalReminder(now, renewal.days);
  await interaction.update({
    content: t(renewal.locale).renewal.saved(discordTimestamp(next, 'R')),
    components: [],
  });
}
