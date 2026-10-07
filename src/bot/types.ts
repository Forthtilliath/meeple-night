import type {
  ActionRowBuilder,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import type { Db } from '../db/client.js';

export type ChatInput = ChatInputCommandInteraction<'cached'>;

/** A message payload accepted by reply, update and edit alike. */
export interface RenderedMessage {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

export interface BotContext {
  client: Client;
  db: Db;
  timezone: string;
}

export interface Command {
  data: { name: string; toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody };
  execute(interaction: ChatInputCommandInteraction<'cached'>, ctx: BotContext): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction<'cached'>, ctx: BotContext): Promise<void>;
}

/** Handles buttons and select menus whose custom id is `<prefix>:<args…>`. */
export interface ComponentHandler {
  prefix: string;
  handle(
    interaction: MessageComponentInteraction<'cached'>,
    args: string[],
    ctx: BotContext,
  ): Promise<void>;
}

/** Handles modal submissions whose custom id is `<prefix>:<args…>`. */
export interface ModalHandler {
  prefix: string;
  handle(
    interaction: ModalSubmitInteraction<'cached'>,
    args: string[],
    ctx: BotContext,
  ): Promise<void>;
}

export function customId(prefix: string, ...args: (string | number)[]): string {
  return [prefix, ...args].join(':');
}
