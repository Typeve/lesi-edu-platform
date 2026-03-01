CREATE TABLE `majors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`college_id` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `majors_id` PRIMARY KEY(`id`),
	CONSTRAINT `majors_college_id_name_unique` UNIQUE(`college_id`,`name`)
);
--> statement-breakpoint
ALTER TABLE `classes` ADD `major_id` int;--> statement-breakpoint
ALTER TABLE `reports` ADD `direction` enum('employment','postgraduate','civil_service') DEFAULT 'employment' NOT NULL;--> statement-breakpoint
ALTER TABLE `majors` ADD CONSTRAINT `majors_college_id_colleges_id_fk` FOREIGN KEY (`college_id`) REFERENCES `colleges`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `majors_college_id_idx` ON `majors` (`college_id`);--> statement-breakpoint
ALTER TABLE `classes` ADD CONSTRAINT `classes_major_id_majors_id_fk` FOREIGN KEY (`major_id`) REFERENCES `majors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `classes_major_id_idx` ON `classes` (`major_id`);--> statement-breakpoint
CREATE INDEX `reports_direction_idx` ON `reports` (`direction`);