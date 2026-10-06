import type { APIApplicationCommandOption } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { commands } from '../src/commands/index.js';

const NAME = /^[-_\p{Ll}\p{N}]{1,32}$/u;

interface Described {
  name: string;
  description: string;
  name_localizations?: Record<string, string | null> | null;
  description_localizations?: Record<string, string | null> | null;
  options?: APIApplicationCommandOption[];
}

function walk(item: Described, path: string, visit: (item: Described, path: string) => void) {
  visit(item, path);
  for (const option of item.options ?? [])
    walk(option as Described, `${path} ${option.name}`, visit);
}

describe('slash commands', () => {
  const json = commands.map((c) => c.data.toJSON());

  it('have unique names', () => {
    expect(new Set(json.map((c) => c.name)).size).toBe(json.length);
  });

  it('are fully localized in French with valid names and descriptions', () => {
    for (const command of json) {
      walk(command as Described, command.name, (item, path) => {
        const fr = {
          name: item.name_localizations?.fr,
          description: item.description_localizations?.fr,
        };
        expect(fr.name, `${path} has no French name`).toBeTruthy();
        expect(fr.description, `${path} has no French description`).toBeTruthy();
        expect(item.name).toMatch(NAME);
        expect(fr.name).toMatch(NAME);
        expect(item.description.length, path).toBeLessThanOrEqual(100);
        expect(fr.description?.length ?? 0, path).toBeLessThanOrEqual(100);
      });
    }
  });
});
