import { MessageFlags } from 'discord.js';
import { canManage } from '../bot/permissions.js';
import type { ComponentHandler } from '../bot/types.js';
import { attendance } from '../domain/reminders.js';
import { t } from '../i18n/index.js';
import { getSettings } from '../repositories/guilds.js';
import { getNight, getRsvps } from '../repositories/nights.js';
import { finalizePoll, getPoll, getPollGames, setVotes } from '../repositories/polls.js';
import { refreshPollNight } from '../ui/poll-closing.js';
import { POLL_PREFIX, renderPoll } from '../ui/poll-message.js';

export const pollHandler: ComponentHandler = {
  prefix: POLL_PREFIX,

  async handle(interaction, [pollId, action], ctx) {
    const { db, timezone } = ctx;
    const m = t(interaction.locale);
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });
    const poll = getPoll(db, Number(pollId));
    // The scheduler may close a due poll up to a minute late: refuse votes past the deadline.
    const expired = poll?.closesAt ? poll.closesAt <= new Date() : false;
    if (!poll || poll.guildId !== interaction.guildId || poll.status !== 'open' || expired) {
      await reply(m.vote.closedAlready);
      return;
    }

    if (action === 'select' && interaction.isStringSelectMenu()) {
      if (poll.attendeesOnly && poll.nightId) {
        const night = getNight(db, poll.guildId, poll.nightId);
        const confirmed = night
          ? attendance(getRsvps(db, night.id), night.maxPlayers).confirmed
          : [];
        if (!confirmed.includes(interaction.user.id)) {
          await reply(m.vote.notAttendee);
          return;
        }
      }
      const allowed = new Set(getPollGames(db, poll.id).map((g) => g.id));
      const gameIds = interaction.values.map(Number).filter((id) => allowed.has(id));
      setVotes(db, poll.id, interaction.user.id, gameIds);
      await interaction.update(renderPoll(db, poll, interaction.guildLocale));
      await interaction.followUp({ content: m.vote.saved, flags: MessageFlags.Ephemeral });
      return;
    }

    if (action === 'close') {
      const { organizerRoleId } = getSettings(db, interaction.guildId, timezone);
      if (!canManage(interaction, poll.createdBy, organizerRoleId)) {
        await reply(m.common.noPermission);
        return;
      }
      const closed = finalizePoll(db, poll);
      await interaction.update(renderPoll(db, closed, interaction.guildLocale));
      await refreshPollNight(ctx, closed);
    }
  },
};
