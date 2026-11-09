CREATE TABLE `booking_hosts` (
	`booking_id` text NOT NULL,
	`user_id` text NOT NULL,
	`calendar_event_id` text,
	PRIMARY KEY(`booking_id`, `user_id`),
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `booking_hosts_user` ON `booking_hosts` (`user_id`);--> statement-breakpoint
CREATE TABLE `event_type_hosts` (
	`event_type_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`event_type_id`, `user_id`),
	FOREIGN KEY (`event_type_id`) REFERENCES `event_types`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `team_invites` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`user_id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_owner_id_unique` ON `teams` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `teams_slug_unique` ON `teams` (`slug`);--> statement-breakpoint
CREATE TABLE `zoom_connections` (
	`user_id` text PRIMARY KEY NOT NULL,
	`account_email` text DEFAULT '' NOT NULL,
	`refresh_token_enc` text NOT NULL,
	`access_token_enc` text,
	`access_token_expires_at` integer,
	`last_error` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `bookings` ADD `meeting_id` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `meeting_password` text;--> statement-breakpoint
ALTER TABLE `event_types` ADD `team_id` text REFERENCES teams(id);--> statement-breakpoint
ALTER TABLE `event_types` ADD `scheduling_type` text;--> statement-breakpoint
-- Backfill: every existing booking is hosted by its owner.
INSERT INTO `booking_hosts` (`booking_id`, `user_id`, `calendar_event_id`) SELECT `id`, `user_id`, `calendar_event_id` FROM `bookings`;
