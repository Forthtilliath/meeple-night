import { en, type Messages } from './en.js';
import { fr } from './fr.js';

export type Locale = 'en' | 'fr';
export type { Messages };

/** Maps a Discord locale ("fr", "en-US", "en-GB"…) to a supported one, English by default. */
export function toLocale(discordLocale: string | null | undefined): Locale {
  return discordLocale?.startsWith('fr') ? 'fr' : 'en';
}

export function t(locale: string | null | undefined): Messages {
  return toLocale(locale) === 'fr' ? fr : en;
}

/** English name/description plus their French localization, for slash command builders. */
export interface LocalizedText {
  name: string;
  description: string;
  fr: { name: string; description: string };
}

interface LocalizableBuilder {
  setName(name: string): unknown;
  setDescription(description: string): unknown;
  setNameLocalizations(localizations: Record<string, string>): unknown;
  setDescriptionLocalizations(localizations: Record<string, string>): unknown;
}

export function localize<B extends LocalizableBuilder>(builder: B, text: LocalizedText): B {
  builder.setName(text.name);
  builder.setDescription(text.description);
  builder.setNameLocalizations({ fr: text.fr.name });
  builder.setDescriptionLocalizations({ fr: text.fr.description });
  return builder;
}

/** Shorthand: `lt('night', 'Game night', 'soiree', 'Soirée de jeux')`. */
export function lt(
  name: string,
  description: string,
  frName: string,
  frDescription: string,
): LocalizedText {
  return { name, description, fr: { name: frName, description: frDescription } };
}
