import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';

/** Errors that retrying will never fix: the channel or server is gone, or access was removed. */
const PERMANENT = new Set<unknown>([
  RESTJSONErrorCodes.UnknownChannel,
  RESTJSONErrorCodes.UnknownGuild,
  RESTJSONErrorCodes.UnknownMessage,
  RESTJSONErrorCodes.MissingAccess,
  RESTJSONErrorCodes.MissingPermissions,
]);

export function isPermanentError(error: unknown): boolean {
  return error instanceof DiscordAPIError && PERMANENT.has(error.code);
}
