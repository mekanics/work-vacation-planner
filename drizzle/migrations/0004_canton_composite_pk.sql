--> statement-breakpoint
CREATE TABLE `public_holidays_new` (
  `date` text NOT NULL,
  `name` text NOT NULL,
  `canton` text NOT NULL,
  `year` integer NOT NULL,
  `global` integer NOT NULL,
  PRIMARY KEY (`date`, `canton`)
);
--> statement-breakpoint
INSERT INTO `public_holidays_new` SELECT `date`, `name`, `canton`, `year`, `global` FROM `public_holidays`;
--> statement-breakpoint
DROP TABLE `public_holidays`;
--> statement-breakpoint
ALTER TABLE `public_holidays_new` RENAME TO `public_holidays`;
