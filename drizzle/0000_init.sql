CREATE TABLE `availability` (
	`user_id` text PRIMARY KEY NOT NULL,
	`weekly` text NOT NULL,
	`overrides` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_type_id` text NOT NULL,
	`start_utc` integer NOT NULL,
	`end_utc` integer NOT NULL,
	`guest_name` text NOT NULL,
	`guest_email` text NOT NULL,
	`guest_timezone` text NOT NULL,
	`answers` text NOT NULL,
	`location_type` text NOT NULL,
	`location_value` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`manage_token` text NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	`calendar_event_id` text,
	`reminder_sent_at` integer,
	`cancel_reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_type_id`) REFERENCES `event_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bookings_user_start` ON `bookings` (`user_id`,`start_utc`);--> statement-breakpoint
CREATE TABLE `calendar_connections` (
	`user_id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`account_email` text DEFAULT '' NOT NULL,
	`refresh_token_enc` text,
	`access_token_enc` text,
	`access_token_expires_at` integer,
	`busy_calendar_ids` text NOT NULL,
	`write_calendar_id` text DEFAULT 'primary' NOT NULL,
	`last_error` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `event_types` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`duration_min` integer DEFAULT 30 NOT NULL,
	`buffer_before_min` integer DEFAULT 0 NOT NULL,
	`buffer_after_min` integer DEFAULT 0 NOT NULL,
	`min_notice_min` integer DEFAULT 240 NOT NULL,
	`daily_limit` integer,
	`slot_step_min` integer DEFAULT 30 NOT NULL,
	`max_days_ahead` integer DEFAULT 60 NOT NULL,
	`location_type` text DEFAULT 'jitsi' NOT NULL,
	`location_value` text DEFAULT '' NOT NULL,
	`questions` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_types_user_slug` ON `event_types` (`user_id`,`slug`);--> statement-breakpoint
CREATE TABLE `login_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`username` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`timezone` text DEFAULT 'America/New_York' NOT NULL,
	`brand_color` text DEFAULT '#4f46e5' NOT NULL,
	`logo` text,
	`cover` text,
	`images_version` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);