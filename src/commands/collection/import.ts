import { MessageFlags } from 'discord.js';
import { DownloadError, downloadAttachment } from '../../bot/download.js';
import { isManager } from '../../bot/permissions.js';
import type { BotContext, ChatInput } from '../../bot/types.js';
import { parseMyLudoExport } from '../../domain/myludo.js';
import { t } from '../../i18n/index.js';
import { importGames } from '../../repositories/games.js';
import { getSettings } from '../../repositories/guilds.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function importCollection(interaction: ChatInput, { db, timezone }: BotContext) {
  const m = t(interaction.locale);
  const reply = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
  const { organizerRoleId } = getSettings(db, interaction.guildId, timezone);
  if (!isManager(interaction, organizerRoleId)) {
    await reply(m.common.noPermission);
    return;
  }
  const file = interaction.options.getAttachment('file', true);
  if (!file.name.toLowerCase().endsWith('.json')) {
    await reply(m.collection.invalidFile);
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    await reply(m.collection.tooLarge);
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  let parsed: ReturnType<typeof parseMyLudoExport>;
  try {
    parsed = parseMyLudoExport(await downloadAttachment(file.url, { maxBytes: MAX_FILE_SIZE }));
  } catch (error) {
    const tooLarge = error instanceof DownloadError && error.reason === 'size';
    await interaction.editReply(tooLarge ? m.collection.tooLarge : m.collection.parseError);
    return;
  }
  const sync = interaction.options.getBoolean('sync') ?? false;
  const { created, updated, archived } = importGames(db, interaction.guildId, parsed.games, {
    sync,
  });
  await interaction.editReply(m.collection.imported(created, updated, parsed.skipped, archived));
}
