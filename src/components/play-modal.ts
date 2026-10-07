import { MessageFlags } from 'discord.js';
import { namedMembers } from '../bot/members.js';
import type { ModalHandler } from '../bot/types.js';
import { PLAY_MODAL_PREFIX, RANKING_INPUT } from '../commands/play/from-night.js';
import { savePlay } from '../commands/play/save.js';
import { parseRanking } from '../domain/play-ranking.js';
import { attendance } from '../domain/reminders.js';
import { t } from '../i18n/index.js';
import { getGame } from '../repositories/games.js';
import { getNight, getRsvps } from '../repositories/nights.js';

/** Submission of the "record from a night" form. */
export const playModalHandler: ModalHandler = {
  prefix: PLAY_MODAL_PREFIX,

  async handle(interaction, [nightId, gameId], ctx) {
    const { db } = ctx;
    const m = t(interaction.locale);
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });
    const night = getNight(db, interaction.guildId, Number(nightId));
    const game = getGame(db, interaction.guildId, Number(gameId));
    if (!night || !game) {
      await reply(night ? m.common.gameNotFound : m.common.nightNotFound);
      return;
    }

    const confirmed = attendance(getRsvps(db, night.id), night.maxPlayers).confirmed;
    const candidates = await namedMembers(interaction.guild, confirmed);
    const result = parseRanking(interaction.fields.getTextInputValue(RANKING_INPUT), candidates);
    if ('error' in result) {
      const messages = {
        unknown: () => m.play.unknownPlayer('name' in result ? result.name : ''),
        duplicate: () => m.play.duplicateLine('name' in result ? result.name : ''),
        tooFew: () => m.play.needTwoPlayers,
        partialScores: () => m.play.partialScores,
      };
      await reply(messages[result.error]());
      return;
    }
    await savePlay(interaction, ctx, game, result.players, night.id);
  },
};
