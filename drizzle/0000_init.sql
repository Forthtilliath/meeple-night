CREATE TABLE `game_nights` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`message_id` text,
	`title` text NOT NULL,
	`location` text,
	`starts_at` integer NOT NULL,
	`max_players` integer,
	`created_by` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`reminder_day_sent` integer DEFAULT false NOT NULL,
	`reminder_hours_sent` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `game_nights_guild_starts_idx` ON `game_nights` (`guild_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`myludo_id` integer,
	`title` text NOT NULL,
	`year` integer,
	`min_players` integer,
	`max_players` integer,
	`min_duration` integer,
	`max_duration` integer,
	`min_age` integer,
	`categories` text DEFAULT '[]' NOT NULL,
	`mechanics` text DEFAULT '[]' NOT NULL,
	`rating` real,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `games_guild_title_idx` ON `games` (`guild_id`,`title`);--> statement-breakpoint
CREATE UNIQUE INDEX `games_guild_myludo_unique` ON `games` (`guild_id`,`myludo_id`);--> statement-breakpoint
CREATE TABLE `play_players` (
	`play_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`rank` integer NOT NULL,
	`score` integer,
	PRIMARY KEY(`play_id`, `user_id`),
	FOREIGN KEY (`play_id`) REFERENCES `plays`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `plays` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`game_id` integer NOT NULL,
	`played_at` integer NOT NULL,
	`recorded_by` text NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plays_guild_played_idx` ON `plays` (`guild_id`,`played_at`);--> statement-breakpoint
CREATE TABLE `poll_options` (
	`poll_id` integer NOT NULL,
	`game_id` integer NOT NULL,
	PRIMARY KEY(`poll_id`, `game_id`),
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `poll_votes` (
	`poll_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`game_id` integer NOT NULL,
	PRIMARY KEY(`poll_id`, `user_id`, `game_id`),
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `polls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`message_id` text,
	`night_id` integer,
	`players` integer,
	`created_by` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`night_id`) REFERENCES `game_nights`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `rsvps` (
	`night_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`night_id`, `user_id`),
	FOREIGN KEY (`night_id`) REFERENCES `game_nights`(`id`) ON UPDATE no action ON DELETE cascade
);
