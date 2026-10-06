import { MessageFlags } from 'discord.js';
import type { ComponentHandler } from '../bot/types.js';
import type { RsvpStatus } from '../db/schema.js';
import { attendance } from '../domain/reminders.js';
import { t } from '../i18n/index.js';
import { getNight, getRsvps, setRsvp } from '../repositories/nights.js';
import { isOpen, RSVP_PREFIX, renderNight } from '../ui/night-message.js';

const STATUSES = new Set<RsvpStatus>(['yes', 'maybe', 'no']);

export const rsvpHandler: ComponentHandler = {
  prefix: RSVP_PREFIX,

  async handle(interaction, [nightId, status], { db }) {
    const m = t(interaction.locale).night;
    const night = getNight(db, interaction.guildId, Number(nightId));
    if (!night || !STATUSES.has(status as RsvpStatus) || !isOpen(night)) {
      await interaction.reply({ content: m.closed, flags: MessageFlags.Ephemeral });
      return;
    }
    const answer = status as RsvpStatus;
    setRsvp(db, night.id, interaction.user.id, answer);
    await interaction.update(renderNight(db, night, interaction.guildLocale));

    const waitlisted =
      answer === 'yes' &&
      attendance(getRsvps(db, night.id), night.maxPlayers).waitlist.includes(interaction.user.id);
    await interaction.followUp({
      content: waitlisted ? m.waitlisted : m.rsvpSaved[answer],
      flags: MessageFlags.Ephemeral,
    });
  },
};
