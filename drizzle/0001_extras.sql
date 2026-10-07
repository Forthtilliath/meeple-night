CREATE TABLE `guild_settings` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`timezone` text,
	`organizer_role_id` text,
	`reminder_early_hours` integer DEFAULT 24 NOT NULL,
	`reminder_late_hours` integer DEFAULT 2 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `game_nights` ADD `game_id` integer REFERENCES games(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `game_nights` ADD `scheduled_event_id` text;--> statement-breakpoint
ALTER TABLE `game_nights` ADD `recurrence` text;--> statement-breakpoint
ALTER TABLE `game_nights` ADD `start_handled` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `game_nights` SET `start_handled` = true WHERE `starts_at` < (unixepoch() - 86400) * 1000;--> statement-breakpoint
ALTER TABLE `games` ADD `archived` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `plays` ADD `night_id` integer REFERENCES game_nights(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `polls` ADD `closes_at` integer;--> statement-breakpoint
ALTER TABLE `polls` ADD `attendees_only` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `polls` ADD `winner_game_id` integer REFERENCES games(id) ON DELETE set null;
