import { AttachmentBuilder, MessageFlags } from 'discord.js';
import type { ComponentHandler } from '../bot/types.js';
import { buildIcs } from '../domain/ics.js';
import { nightEnd } from '../domain/schedule.js';
import { t } from '../i18n/index.js';
import { getNight } from '../repositories/nights.js';
import { CALENDAR_PREFIX, isOpen, nightUrl } from '../ui/night-message.js';

/** "Calendar" button: sends the night as a private .ics file. */
export const calendarHandler: ComponentHandler = {
  prefix: CALENDAR_PREFIX,

  async handle(interaction, [nightId], { db }) {
    const m = t(interaction.locale).night;
    const night = getNight(db, interaction.guildId, Number(nightId));
    if (!night || !isOpen(night)) {
      await interaction.reply({ content: m.closed, flags: MessageFlags.Ephemeral });
      return;
    }
    const url = nightUrl(night);
    const ics = buildIcs({
      uid: `night-${night.id}-${night.guildId}@meeple-night`,
      title: night.title,
      start: night.startsAt,
      end: nightEnd(night.startsAt),
      location: night.location,
      description: url,
      url,
    });
    await interaction.reply({
      content: m.calendarFile,
      files: [new AttachmentBuilder(Buffer.from(ics), { name: `game-night-${night.id}.ics` })],
      flags: MessageFlags.Ephemeral,
    });
  },
};
