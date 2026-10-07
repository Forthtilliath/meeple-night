import { MessageFlags } from 'discord.js';
import type { BotContext, ChatInput } from '../../bot/types.js';
import { ranksFromScores } from '../../domain/elo.js';
import { t } from '../../i18n/index.js';
import { getGame } from '../../repositories/games.js';
import { savePlay } from './save.js';

export const MAX_PLAYERS = 8;

export async function recordPlayCommand(interaction: ChatInput, ctx: BotContext): Promise<void> {
  const m = t(interaction.locale);
  const reply = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
  const game = getGame(ctx.db, interaction.guildId, interaction.options.getInteger('game', true));
  if (!game || game.archived) {
    await reply(m.common.gameNotFound);
    return;
  }

  const userIds: string[] = [];
  for (let i = 1; i <= MAX_PLAYERS; i++) {
    const user = interaction.options.getUser(`player${i}`);
    if (user) userIds.push(user.id);
  }
  if (userIds.length < 2) {
    await reply(m.play.needTwoPlayers);
    return;
  }
  if (new Set(userIds).size !== userIds.length) {
    await reply(m.play.duplicatePlayers);
    return;
  }

  const scoresInput = interaction.options.getString('scores');
  let scores: number[] | null = null;
  if (scoresInput) {
    scores = scoresInput
      .split(/[,;\s]+/)
      .filter(Boolean)
      .map(Number);
    if (scores.length !== userIds.length || scores.some((s) => !Number.isInteger(s))) {
      await reply(m.play.scoresMismatch(userIds.length));
      return;
    }
  }
  const ranks = scores ? ranksFromScores(scores) : userIds.map((_, i) => i + 1);
  const players = userIds.map((userId, i) => ({
    userId,
    rank: ranks[i] ?? i + 1,
    score: scores?.[i] ?? null,
  }));
  await savePlay(interaction, ctx, game, players);
}
