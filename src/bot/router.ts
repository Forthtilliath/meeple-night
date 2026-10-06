import { type Interaction, type InteractionReplyOptions, MessageFlags } from 'discord.js';
import { t } from '../i18n/index.js';
import type { BotContext, Command, ComponentHandler } from './types.js';

/** Dispatches slash commands, autocompletes and components, and reports errors to the user. */
export function createRouter(
  commands: Command[],
  handlers: ComponentHandler[],
  ctx: BotContext,
): (interaction: Interaction) => Promise<void> {
  const byName = new Map(commands.map((c) => [c.data.name, c]));
  const byPrefix = new Map(handlers.map((h) => [h.prefix, h]));

  return async (interaction) => {
    if (!interaction.inCachedGuild()) {
      if (interaction.isRepliable()) {
        await interaction.reply({
          content: t(interaction.locale).common.guildOnly,
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    try {
      if (interaction.isChatInputCommand()) {
        await byName.get(interaction.commandName)?.execute(interaction, ctx);
      } else if (interaction.isAutocomplete()) {
        await byName.get(interaction.commandName)?.autocomplete?.(interaction, ctx);
      } else if (interaction.isMessageComponent()) {
        const [prefix = '', ...args] = interaction.customId.split(':');
        await byPrefix.get(prefix)?.handle(interaction, args, ctx);
      }
    } catch (error) {
      console.error('Interaction failed', error);
      if (!interaction.isRepliable()) return;
      const reply: InteractionReplyOptions = {
        content: t(interaction.locale).common.error,
        flags: MessageFlags.Ephemeral,
      };
      await (interaction.replied || interaction.deferred
        ? interaction.followUp(reply)
        : interaction.reply(reply)
      ).catch(() => undefined);
    }
  };
}
