import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb } from '../../src/db/client.js';
import { gameNights, games } from '../../src/db/schema.js';

describe('migrations', () => {
  it('unlinks a night from its game when the game row is deleted', () => {
    const db = createDb(':memory:');
    const game = db.insert(games).values({ guildId: 'g', title: 'Azul' }).returning().get();
    const night = db
      .insert(gameNights)
      .values({
        guildId: 'g',
        channelId: 'c',
        title: 'Night',
        startsAt: new Date(),
        createdBy: 'u',
        gameId: game.id,
      })
      .returning()
      .get();
    db.delete(games).where(eq(games.id, game.id)).run();
    const after = db.select().from(gameNights).where(eq(gameNights.id, night.id)).get();
    expect(after?.gameId).toBeNull();
  });
});
