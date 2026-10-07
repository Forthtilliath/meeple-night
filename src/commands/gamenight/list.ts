import { EmbedBuilder, MessageFlags } from 'discord.js';
import type { BotContext, ChatInput } from '../../bot/types.js';
import { discordTimestamp } from '../../domain/dates.js';
import { t } from '../../i18n/index.js';
import { upcomingNights } from '../../repositories/nights.js';
import { nightUrl } from '../../ui/night-message.js';
import { plain } from '../../ui/text.js';

export async function listNightsCommand(interaction: ChatInput, { db }: BotContext) {
  const m = t(interaction.locale);
  const nights = upcomingNights(db, interaction.guildId, new Date(), 10);
  if (nights.length === 0) {
    await interaction.reply({ content: m.night.noUpcoming, flags: MessageFlags.Ephemeral });
    return;
  }
  const lines = nights.map((n) => {
    const link = nightUrl(n);
    const title = link ? `[${plain(n.title)}](${link})` : plain(n.title);
    return `**${title}** — ${discordTimestamp(n.startsAt, 'f')} (${discordTimestamp(n.startsAt, 'R')})`;
  });
  const embed = new EmbedBuilder().setTitle(m.night.upcomingTitle).setDescription(lines.join('\n'));
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
