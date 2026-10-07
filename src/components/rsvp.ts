import { MessageFlags } from 'discord.js';
import type { ComponentHandler } from '../bot/types.js';
import type { RsvpStatus } from '../db/schema.js';
import { attendance, promotedUsers } from '../domain/reminders.js';
import { t } from '../i18n/index.js';
import { serverLocale } from '../repositories/guilds.js';
import { getNight, getRsvps, setRsvp } from '../repositories/nights.js';
import { isOpen, notifyNight, RSVP_PREFIX, renderNight } from '../ui/night-message.js';
import { plain } from '../ui/text.js';

const STATUSES = new Set<RsvpStatus>(['yes', 'maybe', 'no']);

export const rsvpHandler: ComponentHandler = {
  prefix: RSVP_PREFIX,

  async handle(interaction, [nightId, status], { client, db }) {
    const m = t(interaction.locale).night;
    const night = getNight(db, interaction.guildId, Number(nightId));
    if (!night || !STATUSES.has(status as RsvpStatus) || !isOpen(night)) {
      await interaction.reply({ content: m.closed, flags: MessageFlags.Ephemeral });
      return;
    }
    const answer = status as RsvpStatus;
    const before = attendance(getRsvps(db, night.id), night.maxPlayers);
    setRsvp(db, night.id, interaction.user.id, answer);
    const after = attendance(getRsvps(db, night.id), night.maxPlayers);
    const locale = serverLocale(db, night.guildId, interaction.guildLocale);
    await interaction.update(renderNight(db, night, locale));

    const waitlisted = answer === 'yes' && after.waitlist.includes(interaction.user.id);
    await interaction.followUp({
      content: waitlisted ? m.waitlisted : m.rsvpSaved[answer],
      flags: MessageFlags.Ephemeral,
    });

    // Someone left a full night: tell whoever got their seat.
    const promoted = promotedUsers(before, after);
    if (promoted.length > 0) {
      await notifyNight(
        client,
        db,
        night,
        (locale) => t(locale).night.noticePromoted(plain(night.title)),
        promoted,
      );
    }
  },
};
