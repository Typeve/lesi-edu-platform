CREATE TABLE `teacher_activity_assignments` (
  `id` int AUTO_INCREMENT NOT NULL,
  `activity_id` int NOT NULL,
  `teacher_id` varchar(64) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `teacher_activity_assignments_id` PRIMARY KEY(`id`),
  CONSTRAINT `teacher_activity_assignments_activity_teacher_unique` UNIQUE(`activity_id`,`teacher_id`)
);
--> statement-breakpoint
ALTER TABLE `teacher_activity_assignments` ADD CONSTRAINT `teacher_activity_assignments_activity_id_activities_id_fk` FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `teacher_activity_assignments_teacher_id_idx` ON `teacher_activity_assignments` (`teacher_id`);
--> statement-breakpoint
CREATE TABLE `activity_execution_records` (
  `id` int AUTO_INCREMENT NOT NULL,
  `activity_id` int NOT NULL,
  `teacher_id` varchar(64) NOT NULL,
  `payload_json` text NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `activity_execution_records_id` PRIMARY KEY(`id`),
  CONSTRAINT `activity_execution_records_activity_teacher_unique` UNIQUE(`activity_id`,`teacher_id`)
);
--> statement-breakpoint
ALTER TABLE `activity_execution_records` ADD CONSTRAINT `activity_execution_records_activity_id_activities_id_fk` FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `activity_execution_records_teacher_id_idx` ON `activity_execution_records` (`teacher_id`);
