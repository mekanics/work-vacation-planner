CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`colour` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`weekdays` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);