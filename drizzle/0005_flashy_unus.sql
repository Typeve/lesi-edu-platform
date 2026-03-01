CREATE TABLE `certificate_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`file_id` varchar(64) NOT NULL,
	`student_id` int NOT NULL,
	`original_name` varchar(255) NOT NULL,
	`mime_type` varchar(128) NOT NULL,
	`size_bytes` int NOT NULL,
	`storage_path` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `certificate_files_id` PRIMARY KEY(`id`),
	CONSTRAINT `certificate_files_file_id_unique` UNIQUE(`file_id`)
);
--> statement-breakpoint
ALTER TABLE `certificate_files` ADD CONSTRAINT `certificate_files_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `certificate_files_student_id_idx` ON `certificate_files` (`student_id`);--> statement-breakpoint
CREATE INDEX `certificate_files_created_at_idx` ON `certificate_files` (`created_at`);