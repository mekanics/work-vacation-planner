CREATE TABLE IF NOT EXISTS `project_day_overrides` (
  `project_id` text NOT NULL,
  `date` text NOT NULL,
  `type` text NOT NULL,
  PRIMARY KEY(`project_id`, `date`),
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
