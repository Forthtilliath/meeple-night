import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core';

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`);

/** Playable games of a guild's shared collection (imported from MyLudo or added manually). */
export const games = sqliteTable(
  'games',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    guildId: text('guild_id').notNull(),
    myludoId: integer('myludo_id'),
    title: text('title').notNull(),
    year: integer('year'),
    minPlayers: integer('min_players'),
    maxPlayers: integer('max_players'),
    minDuration: integer('min_duration'),
    maxDuration: integer('max_duration'),
    minAge: integer('min_age'),
    categories: text('categories', { mode: 'json' }).$type<string[]>().notNull().default([]),
    mechanics: text('mechanics', { mode: 'json' }).$type<string[]>().notNull().default([]),
    rating: real('rating'),
    createdAt: createdAt(),
  },
  (t) => [
    unique('games_guild_myludo_unique').on(t.guildId, t.myludoId),
    index('games_guild_title_idx').on(t.guildId, t.title),
  ],
);

export const gameNights = sqliteTable(
  'game_nights',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    guildId: text('guild_id').notNull(),
    channelId: text('channel_id').notNull(),
    messageId: text('message_id'),
    title: text('title').notNull(),
    location: text('location'),
    startsAt: integer('starts_at', { mode: 'timestamp_ms' }).notNull(),
    maxPlayers: integer('max_players'),
    createdBy: text('created_by').notNull(),
    status: text('status', { enum: ['scheduled', 'cancelled'] })
      .notNull()
      .default('scheduled'),
    reminderDaySent: integer('reminder_day_sent', { mode: 'boolean' }).notNull().default(false),
    reminderHoursSent: integer('reminder_hours_sent', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('game_nights_guild_starts_idx').on(t.guildId, t.startsAt)],
);

export const rsvps = sqliteTable(
  'rsvps',
  {
    nightId: integer('night_id')
      .notNull()
      .references(() => gameNights.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    status: text('status', { enum: ['yes', 'maybe', 'no'] }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.nightId, t.userId] })],
);

export const polls = sqliteTable('polls', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  guildId: text('guild_id').notNull(),
  channelId: text('channel_id').notNull(),
  messageId: text('message_id'),
  nightId: integer('night_id').references(() => gameNights.id, { onDelete: 'set null' }),
  /** Player count the candidates were filtered for, if any. */
  players: integer('players'),
  createdBy: text('created_by').notNull(),
  status: text('status', { enum: ['open', 'closed'] })
    .notNull()
    .default('open'),
  createdAt: createdAt(),
});

export const pollOptions = sqliteTable(
  'poll_options',
  {
    pollId: integer('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.pollId, t.gameId] })],
);

/** Approval voting: a user can approve several options of a poll. */
export const pollVotes = sqliteTable(
  'poll_votes',
  {
    pollId: integer('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.pollId, t.userId, t.gameId] })],
);

export const plays = sqliteTable(
  'plays',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    guildId: text('guild_id').notNull(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    playedAt: integer('played_at', { mode: 'timestamp_ms' }).notNull(),
    recordedBy: text('recorded_by').notNull(),
  },
  (t) => [index('plays_guild_played_idx').on(t.guildId, t.playedAt)],
);

/** Finishing position of each player: rank 1 is the winner, equal ranks are ties. */
export const playPlayers = sqliteTable(
  'play_players',
  {
    playId: integer('play_id')
      .notNull()
      .references(() => plays.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    rank: integer('rank').notNull(),
    score: integer('score'),
  },
  (t) => [primaryKey({ columns: [t.playId, t.userId] })],
);

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type GameNight = typeof gameNights.$inferSelect;
export type Rsvp = typeof rsvps.$inferSelect;
export type RsvpStatus = Rsvp['status'];
export type Poll = typeof polls.$inferSelect;
