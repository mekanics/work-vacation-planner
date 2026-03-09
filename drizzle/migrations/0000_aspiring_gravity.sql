CREATE TABLE `days` (
	`date` text PRIMARY KEY NOT NULL,
	`day_type` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `public_holidays` (
	`date` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`canton` text NOT NULL,
	`year` integer NOT NULL,
	`global` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
