import { MessageFlags } from 'discord.js';
import type { ComponentHandler } from '../bot/types.js';
import { fitsFilter } from '../domain/voting.js';
import { t } from '../i18n/index.js';
import { listGames } from '../repositories/games.js';
import {
  COLLECTION_PAGE_PREFIX,
  decodeFilter,
  renderCollectionPage,
} from '../ui/collection-message.js';

/** Previous / next buttons of /collection list. */
export const collectionPageHandler: ComponentHandler = {
  prefix: COLLECTION_PAGE_PREFIX,

  async handle(interaction, [page, players, maxDuration], { db }) {
    const filter = decodeFilter(players, maxDuration);
    const games = listGames(db, interaction.guildId).filter((game) => fitsFilter(game, filter));
    if (games.length === 0) {
      const m = t(interaction.locale).collection;
      await interaction.reply({ content: m.noMatch, flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.update(
      renderCollectionPage(games, Number(page) || 0, filter, interaction.locale),
    );
  },
};
