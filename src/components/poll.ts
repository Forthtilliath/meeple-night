import { MessageFlags } from 'discord.js';
import { canManage } from '../bot/permissions.js';
import type { ComponentHandler } from '../bot/types.js';
import { t } from '../i18n/index.js';
import { getSettings } from '../repositories/guilds.js';
import { closePoll, getPoll, getPollGames, setVotes } from '../repositories/polls.js';
import { POLL_PREFIX, renderPoll } from '../ui/poll-message.js';

export const pollHandler: ComponentHandler = {
  prefix: POLL_PREFIX,

  async handle(interaction, [pollId, action], { db, timezone }) {
    const m = t(interaction.locale);
    const poll = getPoll(db, Number(pollId));
    if (!poll || poll.guildId !== interaction.guildId || poll.status !== 'open') {
      await interaction.reply({ content: m.vote.closedAlready, flags: MessageFlags.Ephemeral });
      return;
    }

    if (action === 'select' && interaction.isStringSelectMenu()) {
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
        await interaction.reply({ content: m.common.noPermission, flags: MessageFlags.Ephemeral });
        return;
      }
      closePoll(db, poll.id);
      await interaction.update(
        renderPoll(db, { ...poll, status: 'closed' }, interaction.guildLocale),
      );
    }
  },
};
