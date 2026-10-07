import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { BotContext, ChatInput, Command } from '../bot/types.js';
import { isValidTimezone } from '../domain/dates.js';
import { localize, lt, t, toLocale } from '../i18n/index.js';
import { getSettings, MAX_REMINDER_HOURS, updateSettings } from '../repositories/guilds.js';

const TIMEZONES = Intl.supportedValuesOf('timeZone');
/** Choice that clears the setting, so the Discord server language applies again. */
const AUTO_LOCALE = 'auto';
const LANGUAGE_NAMES = { en: 'English', fr: 'Français' } as const;

const data = localize(
  new SlashCommandBuilder(),
  lt(
    'settings',
    'Configure the bot for this server',
    'reglages',
    'Configurer le bot sur ce serveur',
  ),
)
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    localize(sub, lt('show', 'Show the current settings', 'afficher', 'Voir les réglages')),
  )
  .addSubcommand((sub) =>
    localize(
      sub,
      lt(
        'timezone',
        'Timezone of the dates typed in commands',
        'fuseau',
        'Fuseau des dates saisies',
      ),
    ).addStringOption((o) =>
      localize(o, lt('zone', 'e.g. Europe/Paris', 'zone', 'ex. Europe/Paris'))
        .setRequired(true)
        .setAutocomplete(true),
    ),
  )
  .addSubcommand((sub) =>
    localize(
      sub,
      lt(
        'organizer_role',
        'Role allowed to manage nights, votes and the collection',
        'role_organisateur',
        'Rôle autorisé à gérer soirées, votes et collection',
      ),
    ).addRoleOption((o) =>
      localize(o, lt('role', 'Leave empty to remove it', 'role', 'Laisser vide pour le retirer')),
    ),
  )
  .addSubcommand((sub) =>
    localize(
      sub,
      lt('reminders', 'When reminders are sent', 'rappels', 'Quand envoyer les rappels'),
    )
      .addIntegerOption((o) =>
        localize(
          o,
          lt(
            'first',
            'Hours before the night (default 24)',
            'premier',
            'Heures avant (24 par défaut)',
          ),
        )
          .setRequired(true)
          .setMinValue(2)
          .setMaxValue(MAX_REMINDER_HOURS),
      )
      .addIntegerOption((o) =>
        localize(
          o,
          lt(
            'second',
            'Hours before the night (default 2)',
            'second',
            'Heures avant (2 par défaut)',
          ),
        )
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(24),
      ),
  )
  .addSubcommand((sub) =>
    localize(
      sub,
      lt(
        'language',
        'Language of the public messages (nights, votes, reminders)',
        'langue',
        'Langue des messages publics (soirées, votes, rappels)',
      ),
    ).addStringOption((o) =>
      localize(o, lt('value', 'Language to use', 'valeur', 'Langue à utiliser'))
        .setRequired(true)
        .addChoices(
          { name: 'Français', value: 'fr' },
          { name: 'English', value: 'en' },
          {
            name: 'Discord server language',
            name_localizations: { fr: 'Langue du serveur Discord' },
            value: AUTO_LOCALE,
          },
        ),
    ),
  );

async function show(interaction: ChatInput, { db, timezone }: BotContext) {
  const m = t(interaction.locale).settings;
  const settings = getSettings(db, interaction.guildId, timezone);
  const embed = new EmbedBuilder().setTitle(m.title).addFields(
    { name: m.timezone, value: settings.timezone, inline: true },
    {
      name: m.organizerRole,
      value: settings.organizerRoleId ? `<@&${settings.organizerRoleId}>` : m.noRole,
      inline: true,
    },
    {
      name: m.reminders,
      value: m.reminderHours(settings.reminderEarlyHours, settings.reminderLateHours),
    },
    {
      name: m.language,
      value: settings.locale ? LANGUAGE_NAMES[settings.locale] : m.languageAuto,
    },
  );
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

export const settings: Command = {
  data,

  async execute(interaction, ctx) {
    const { db } = ctx;
    const m = t(interaction.locale).settings;
    const sub = interaction.options.getSubcommand();
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });

    if (sub === 'show') {
      await show(interaction, ctx);
      return;
    }
    if (sub === 'timezone') {
      const zone = interaction.options.getString('zone', true).trim();
      if (!isValidTimezone(zone)) {
        await reply(m.invalidTimezone);
        return;
      }
      updateSettings(db, interaction.guildId, { timezone: zone });
    } else if (sub === 'organizer_role') {
      const role = interaction.options.getRole('role');
      updateSettings(db, interaction.guildId, { organizerRoleId: role?.id ?? null });
    } else if (sub === 'language') {
      const value = interaction.options.getString('value', true);
      const locale = value === AUTO_LOCALE ? null : toLocale(value);
      updateSettings(db, interaction.guildId, { locale });
    } else {
      const early = interaction.options.getInteger('first', true);
      const late = interaction.options.getInteger('second', true);
      if (late >= early) {
        await reply(m.invalidReminders);
        return;
      }
      updateSettings(db, interaction.guildId, {
        reminderEarlyHours: early,
        reminderLateHours: late,
      });
    }
    await reply(m.saved);
  },

  async autocomplete(interaction) {
    const query = interaction.options.getFocused().toLowerCase();
    const zones = TIMEZONES.filter((zone) => zone.toLowerCase().includes(query)).slice(0, 25);
    await interaction.respond(zones.map((zone) => ({ name: zone, value: zone })));
  },
};
