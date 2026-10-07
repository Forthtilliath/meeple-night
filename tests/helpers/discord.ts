import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';

export function discordError(code: number): DiscordAPIError {
  return new DiscordAPIError({ code, message: 'error' }, code, 403, 'GET', '/x', {});
}

export const MISSING_ACCESS = RESTJSONErrorCodes.MissingAccess;

/** Minimal sendable guild text channel recording what it sends. */
export function fakeChannel(locale = 'fr') {
  const sent: { content: string; allowedMentions?: unknown }[] = [];
  return {
    sent,
    channel: {
      guild: { preferredLocale: locale },
      isSendable: () => true,
      isDMBased: () => false,
      isTextBased: () => true,
      send: async (message: { content: string; allowedMentions?: unknown }) => {
        sent.push(message);
        return { id: `m${sent.length}` };
      },
      messages: { edit: async () => undefined },
    },
  };
}
