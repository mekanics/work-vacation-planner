CREATE TABLE `clients` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `colour` text NOT NULL,
  `default_weekdays` text NOT NULL,
  `archived` integer DEFAULT 0 NOT NULL,
  `is_system` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `clients`
  (`id`, `name`, `colour`, `default_weekdays`, `archived`, `is_system`, `created_at`, `updated_at`)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'Internal', '#64748b', '[1,2,3,4,5]', 0, 1, '2026-11-13T00:00:00.000Z', '2026-11-13T00:00:00.000Z');
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__client_migration_overrides` AS SELECT * FROM `project_day_overrides`;
--> statement-breakpoint
DROP TABLE `project_day_overrides`;
--> statement-breakpoint
CREATE TABLE `__new_projects` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `client_id` text NOT NULL,
  `end_client` text,
  `colour` text,
  `start_date` text,
  `end_date` text,
  `weekdays` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_projects`
  (`id`, `name`, `client_id`, `end_client`, `colour`, `start_date`, `end_date`, `weekdays`, `created_at`, `updated_at`)
SELECT
  `id`, `name`, '00000000-0000-0000-0000-000000000000', NULL, `colour`, `start_date`, `end_date`, `weekdays`, `created_at`, `updated_at`
FROM `projects`;
--> statement-breakpoint
DROP TABLE `projects`;
--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;
--> statement-breakpoint
CREATE TABLE `project_day_overrides` (
  `project_id` text NOT NULL,
  `date` text NOT NULL,
  `type` text NOT NULL,
  PRIMARY KEY(`project_id`, `date`),
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `project_day_overrides` SELECT * FROM `__client_migration_overrides`;
--> statement-breakpoint
DROP TABLE `__client_migration_overrides`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
